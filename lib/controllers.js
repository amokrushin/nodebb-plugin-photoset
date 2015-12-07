'use strict';

var Controllers = {},
    async = require.main.require( 'async' ),
    meta = require.main.require( './src/meta' ),
    multiparty = require( 'multiparty' ),
    crypto = require( 'crypto' ),
    path = require( 'path' ),
    url = require( 'url' ),
    gcloud = require( 'gcloud' ),
    cheerio = require( 'cheerio' ),
    rmq = require( 'amqplib/callback_api' ),
    imageFilename = require( './../shared/image-filename' ),
    filenameHmac = require( './filename-hmac' );

function http400( res ) {
    res.status( 400 ).json( 'Bad Request' );
}

function http403( res ) {
    res.status( 403 ).json( 'Forbidden' );
}

function http404( res ) {
    res.status( 404 ).json( 'Not Found' );
}

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
        var createImageSizeStream = require( 'image-size-stream' ),
            imageSizeStream = createImageSizeStream(),
            hashStream = crypto.createHash( 'md5' ).setEncoding( 'hex' ),
            imageinfo = {
                originalFilename: imageReadStream.filename,
                uriFilename: imageReadStream.filename
                    .replace( /\d+_\d{13}/, '' ) // i + '_' + Date.now() + '_' + files[i].
                    .replace( /\s/g, '_' )
                    .replace( /[^a-zа-яё0-9()._-]/gi, '' )
                    .toLowerCase(),
                ext: path.extname( imageReadStream.filename ).toLowerCase()
            };

        imageReadStream.on( 'data', function( chunk ) {
            imageSizeStream.write( chunk );
            hashStream.write( chunk );
        } );
        imageReadStream.on( 'end', function( err ) {
            hashStream.end();
        } );

        imageSizeStream.on( 'error', callback );
        hashStream.on( 'error', callback );
        imageWriteStream.on( 'error', callback );

        async.parallel( [
            function( callback ) {
                imageSizeStream.on( 'size', function( dimensions ) {
                    imageinfo.originalWidth = dimensions.width;
                    imageinfo.originalHeight = dimensions.height;
                    callback();
                } );
            },
            function( callback ) {
                hashStream.on( 'finish', function() {
                    imageinfo.hash = hashStream.read();
                    callback();
                } );
            },
            function( callback ) {
                imageWriteStream.on( 'finish', function() {
                    callback();
                } );
            }
        ], function() {
            imageinfo.filename = imageFilename.encode( imageinfo, true );

            callback( null, imageinfo );
        } );

        imageReadStream.pipe( imageWriteStream );
    }

    var queue = async.queue( function( imageReadStream, callback ) {
        var remoteFile = bucket.file( 'temp-' + Date.now() ),
            imageWriteStream = remoteFile.createWriteStream();
        streamImageTransfer( imageReadStream, imageWriteStream, function( err, imageinfo ) {
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
            var thumbnail = imageFilename.thumbnail( file.filename + file.ext, settings.imagePreviewMaxDimension, true );
            filenameHmac( settings.hmacKey, thumbnail + file.ext, function( err, hmac ) {
                callback( null, {
                    name: file.originalFilename,
                    url: baseUrl + '/static/' + hmac + '/' + thumbnail + '/' + file.uriFilename
                } );
            } );
        }, function( err, files ) {
            res.status( 200 ).send( req.xhr ? files : JSON.stringify( files ) );
        } );
    };

    form.parse( req );
};

Controllers.download = function( req, res ) {
    var settings = module.parent.exports.settings;

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

    async.auto( {
        bucket: [function( callback ) {
            var config = {
                    projectId: settings.projectId,
                    credentials: {
                        client_email: settings.clientEmail,
                        private_key: settings.privateKey
                    }
                },
                gcs = gcloud.storage( config ),
                bucket = gcs.bucket( settings.bucket );

            callback( null, bucket );
        }],
        rmqUrl: [function( callback, task ) {
            callback( null, url.format( {
                protocol: 'amqp',
                slashes: true,
                auth: settings.rmqUser + ':' + settings.rmqPassword,
                host: settings.rmqHost,
                query: {heartbeat: 30}
            } ) );
        }]
    }, function( err, task ) {
        var request = url.parse( req.url, true ),
        /* <base_url>/(<hmac>)/(<encoded_filename>)/<original_filename>(.<extension>) */
            match = request.pathname.match( /\/([0-9a-z]+)\/([-0-9a-z]+)\/[^\/]+(\.[0-9a-z]{2,4})$/ ),
            urlHash,
            filename;

        if( !match ) return http400( res );
        //mimeType = mime.lookup( request.pathname ),
        urlHash = match[1];
        filename = match[2] + match[3];

        filenameHmac( settings.hmacKey, filename, function( err, hmac ) {
            if( hmac !== urlHash ) return http403( res );

            task.bucket.file( filename ).exists( function( err, fileExists ) {
                var bucket = task.bucket;
                if( fileExists )
                {
                    bucket.file( filename ).createReadStream()
                        .on( 'error', async.apply( http503, res ) )
                        .pipe( res );
                }
                else
                {
                    rmqResizeRequest( task.rmqUrl, settings.bucket, filename, function( err ) {
                        if( err ) console.error( err );
                        bucket.file( filename ).createReadStream()
                            .on( 'error', async.apply( http503, res ) )
                            .pipe( res );
                    } );
                }
            } );
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
                urlParser = imageFilename.urlParser( $image.attr( 'src' ) );
            if( !urlParser ) return callback();

            $image.addClass( 'img-photoset not-responsive' ).removeClass( 'img-responsive' );

            var encodedFilename = urlParser.encodedFilename + urlParser.ext,
                imageinfo = imageFilename.decode( encodedFilename );

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

    }, function( err ) {
        post.postData.content = $.html();

        next( null, post );
    } );
};

module.exports = Controllers;