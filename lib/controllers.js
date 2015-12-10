'use strict';

var Controllers = {},
    async = require.main.require( 'async' ),
//meta = require.main.require( './src/meta' ),
    multiparty = require( 'multiparty' ),
    crypto = require( 'crypto' ),
    path = require( 'path' ),
    url = require( 'url' ),
    gcloud = require( 'gcloud' ),
    cheerio = require( 'cheerio' ),
    stream = require( 'stream' ),
    bs58 = require( 'bs58' ),
    gm = require( 'gm' ).subClass( {imageMagick: true} ),
    rmq = require( 'amqplib/callback_api' ),
    imageFilename = require( './../shared/image-filename' ),
    filenameHmac = require( './filename-hmac' );

function http400( res ) {
    res.status( 400 ).json( 'Bad Request' );
}

function http403( res ) {
    res.status( 403 ).json( 'Forbidden' );
}

//function http404( res ) {
//    res.status( 404 ).json( 'Not Found' );
//}

function http500( res, err ) {
    res.status( 503 ).json( err.message );
}

function http503( res, err ) {
    res.status( 503 ).json( err.message );
}

Controllers.renderAdminPage = function( req, res ) {
    var settings = module.parent.exports.settings;
    var buckets = [];
    if( settings.buckets )
    {
        buckets = JSON.parse( settings.buckets );
    }
    res.render( 'admin/plugins/photoset', {buckets: buckets} );
};

Controllers.upload = function( req, res ) {
    var settings = module.parent.exports.settings,
        baseUrl = req.protocol + '://' + req.get( 'host' ),
        gcs = gcloud.storage( {
            projectId: settings.projectId,
            credentials: {
                client_email: settings.clientEmail,
                private_key: settings.privateKey
            }
        } ),
        bucket = gcs.bucket( settings.bucket ),
        form = new multiparty.Form(),
        files = [];

    function streamImageTransfer( imageReadStream, imageWriteStream, callback ) {
        var hashStream = crypto.createHash( 'md5' ).setEncoding( 'hex' ),
            imageMetaStream = new stream.PassThrough(),
            imageinfo = {
                originalFilename: imageReadStream.filename,
                uriFilename: imageReadStream.filename
                    .replace( /\d+_\d{13}/, '' ) // i + '_' + Date.now()
                    .replace( /\s/g, '_' )
                    .replace( /[^a-zа-яё0-9()._-]/gi, '' )
                    .toLowerCase(),
                ext: path.extname( imageReadStream.filename ).toLowerCase()
            };

        imageReadStream.on( 'data', function( chunk ) {
            imageMetaStream.write( chunk );
            hashStream.write( chunk );
        } );
        imageReadStream.on( 'end', function() {
            imageMetaStream.end();
            hashStream.end();
        } );

        imageMetaStream.on( 'error', callback );
        hashStream.on( 'error', callback );
        imageWriteStream.on( 'error', callback );

        async.parallel( [
            function( callback ) {
                gm( imageReadStream )
                    .identify( '%w,%h,%[EXIF:Orientation]', /*{bufferStream: true},*/ function( err, data ) {
                        if( err ) return callback( err );
                        if( !data ) return callback( new Error( 'Wrong image' ) );
                        var meta = data.split( ',' );
                        imageinfo.originalWidth = meta[0];
                        imageinfo.originalHeight = meta[1];
                        imageinfo.exifOrientation = parseInt( meta[2] ) || 0;
                        callback();
                    } );
            },
            function( callback ) {
                hashStream.on( 'finish', function() {
                    imageinfo.hash = bs58.encode( new Buffer( hashStream.read(), 'hex' ) );
                    callback();
                } );
            },
            function( callback ) {
                imageWriteStream.on( 'finish', function() {
                    callback();
                } );
            }
        ], function( err ) {
            if( err ) return callback( err );
            imageinfo.filename = imageFilename.encode( imageinfo, true );
            callback( null, imageinfo );
        } );

        imageReadStream.pipe( imageWriteStream );
    }

    var queue = async.queue( function( imageReadStream, callback ) {
        var remoteFile = bucket.file( 'temp-' + Date.now() ),
            imageWriteStream = remoteFile.createWriteStream();
        streamImageTransfer( imageReadStream, imageWriteStream, function( err, imageinfo ) {
            if( err ) return http500( res, err.message );
            files.push( imageinfo );
            remoteFile.move( imageinfo.filename + imageinfo.ext, callback );
        } );
    } );

    form.on( 'part', function( part ) {
        if( !part.filename ) return;
        queue.push( part );
    } );
    form.on( 'error', async.apply( http500, res ) );

    queue.drain = function() {
        async.map( files, function( file, callback ) {
            var originalFilename = file.filename + file.ext,
                thumbnailFilename = imageFilename.thumbnail( originalFilename, settings.imagePreviewMaxDimension );
            thumbnailFilename = imageFilename.autoOrientation( thumbnailFilename, file.exifOrientation, true );

            filenameHmac( settings.hmacKey, thumbnailFilename + file.ext, function( err, hmac ) {
                callback( null, {
                    name: file.originalFilename,
                    url: baseUrl + '/static/' + hmac + '/' + thumbnailFilename + '/' + file.uriFilename
                } );
            } );
        }, function( err, files ) {
            res.status( 200 ).send( req.xhr ? files : JSON.stringify( files ) );
        } );
    };

    form.parse( req );
};

Controllers.download = function( req, res ) {
    var settings = module.parent.exports.settings,
        gcs = gcloud.storage( {
            projectId: settings.projectId,
            credentials: {
                client_email: settings.clientEmail,
                private_key: settings.privateKey
            }
        } ),
        bucket = gcs.bucket( settings.bucket ),
        rmqUrl = url.format( {
            protocol: 'amqp',
            slashes: true,
            auth: settings.rmqUser + ':' + settings.rmqPassword,
            host: settings.rmqHost,
            query: {heartbeat: 30}
        } ),
        urlParser = imageFilename.urlParser( req.url ),
        filename;

    function rmqResizeRequest( rmqUrl, bucket, filename, callback ) {
        rmq.connect( rmqUrl, function( err, connection ) {
            if( err )return callback( err );
            connection.createChannel( function( err, channel ) {
                if( err ) return callback( err );
                channel.assertQueue( '', {exclusive: true}, function( err, q ) {
                    channel.consume( q.queue, function( msg ) {
                        callback( null, JSON.parse( msg.content.toString() ) );
                        channel.deleteQueue( q.queue );
                        channel.close();
                        connection.close();
                    }, {noAck: true} );
                    channel.sendToQueue(
                        'image_resize_request',
                        new Buffer( JSON.stringify( {
                            bucket: bucket,
                            filename: filename
                        } ) ),
                        {replyTo: q.queue}
                    );
                } );
            } );
        } );
    }


    if( !urlParser ) return http400( res );
    filename = urlParser.encodedFilename + urlParser.ext;

    filenameHmac( settings.hmacKey, filename, function( err, hmac ) {
        if( hmac !== urlParser.filenameHmac ) return http403( res );

        bucket.file( filename ).exists( function( err, fileExists ) {
            if( fileExists )
            {
                bucket.file( filename ).createReadStream()
                    .on( 'error', async.apply( http503, res ) )
                    .pipe( res );
            }
            else
            {
                rmqResizeRequest( rmqUrl, settings.bucket, filename, function( err ) {
                    if( err ) return http500( res, err );
                    bucket.file( filename ).createReadStream()
                        .on( 'error', async.apply( http503, res ) )
                        .pipe( res );
                } );
            }
        } );
    } );
};

Controllers.postParser = function( post, next ) {
    var settings = module.parent.exports.settings,
        $ = cheerio.load( post.postData.content );

    var $images = $( 'img.img-markdown:not(a)' );

    async.eachSeries( $images, function( imageEl, callback ) {
        var $image = $( imageEl );
        if( $image.hasClass( 'img-photoset' ) ) return callback();
        var $container = $( '<div class="photoset-grid hidden"></div>' ).insertBefore( $image ),
            $photoset = $image.nextUntil( ':not(img)' ).add( $image );

        async.eachSeries( $photoset, function( imageEl, callback ) {
            var $image = $( imageEl ),
                urlParser = imageFilename.urlParser( $image.attr( 'src' ) ),
                encodedFilename,
                imageinfo;

            /* not a plugin image */
            if( !urlParser ) return callback();

            encodedFilename = urlParser.encodedFilename + urlParser.ext;
            imageinfo = imageFilename.decode( encodedFilename );

            /* unsupported format version */
            if( !imageinfo ) return callback();

            $image.addClass( 'img-photoset not-responsive' );
            $image.removeClass( 'img-responsive' );
            $image.attr( 'width', imageinfo.width );
            $image.attr( 'height', imageinfo.height );

            var thumbnail = imageFilename.thumbnail( encodedFilename, settings.imageHighresMaxDimension || 1920, true );
            filenameHmac( settings.hmacKey, thumbnail + imageinfo.ext, function( err, hmac ) {
                var url = urlParser.baseUrl + hmac + '/' + thumbnail + '/' + urlParser.originalFilename + urlParser.ext;
                $image.attr( 'data-hires', url );
                callback();
            } );

        }, callback );

        $container.attr( 'data-layout', $photoset.length ).append( $photoset );

    }, function() {
        post.postData.content = $.html();

        next( null, post );
    } );
};

module.exports = Controllers;