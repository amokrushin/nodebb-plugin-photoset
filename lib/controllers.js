'use strict';

var Controllers = {},
    async = require.main.require( 'async' ),
    winston = require.main.require( 'winston' ),
    db = require.main.require( './src/database' ),
    multiparty = require( 'multiparty' ),
    crypto = require( 'crypto' ),
    path = require( 'path' ),
    url = require( 'url' ),
    gcloud = require( 'gcloud' ),
    cheerio = require( 'cheerio' ),
    stream = require( 'stream' ),
    bs58 = require( 'bs58' ),
    gm = require( 'gm' ).subClass( {imageMagick: true} ),
    imageFilename = require( './../shared/image-filename' ),
    filenameHmac = require( './filename-hmac' ),
    _ = require( 'lodash' ),
    mime = require( 'mime-types' );

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


Controllers.renderAdminPage = function( req, res ) {
    var Plugin = module.parent.exports;

    Plugin.updateStatus( null, function() {
        res.render( 'admin/plugins/photoset', {
            buckets: [],
            status: [Plugin.status]
        } );
    } );
};

Controllers.ipwSettings = function( req, res ) {
    var pluginSettings = module.parent.exports.settings,
        settings = _.pick( pluginSettings.get(), ['gcs', 'rmq'] );

    _.assign( settings, {ipw: _.pick( pluginSettings.get( 'ipw' ), ['version', 'transport'] )} );
    res.status( 200 ).end( JSON.stringify( settings ) );
};

Controllers.upload = function( req, res ) {
    if( !req.user ) return http403();

    var gcsSettings = module.parent.exports.settings.get( 'gcs' ),
        photosetSettings = module.parent.exports.settings.get( 'photoset' ),
        baseUrl = req.protocol + '://' + req.get( 'host' ),
        gcs = gcloud.storage( {
            projectId: gcsSettings.projectId,
            credentials: {
                client_email: gcsSettings.credentials.clientEmail,
                private_key: gcsSettings.credentials.privateKey
            }
        } ),
        bucket = gcs.bucket( gcsSettings.bucket ),
        form = new multiparty.Form(),
        files = [],
        imageTypes = [''];

    function streamImageTransfer( readStream, writeStream, callback ) {
        var hashStream = crypto.createHash( 'md5' ).setEncoding( 'hex' ),
            imageMetaStream = new stream.PassThrough(),
            fileinfo = {};

        fileinfo.mimetype = mime.lookup( readStream.filename );
        //fileinfo.ext = '.' + mime.extension( fileinfo.mimetype );
        fileinfo.ext = path.extname( readStream.filename ).toLowerCase();
        fileinfo.isImage = /^image/.test( mime.lookup( readStream.filename ) );
        fileinfo.originalFilename = readStream.filename;
        fileinfo.uriFilename = readStream.filename
            .replace( /\d+_\d{13}/, '' ) // i + '_' + Date.now()
            .replace( /\s/g, '_' )
            .replace( /[^a-zа-яё0-9()._-]/gi, '' )
            .toLowerCase();

        readStream.on( 'data', function( chunk ) {
            imageMetaStream.write( chunk );
            hashStream.write( chunk );
        } );
        readStream.on( 'end', function() {
            imageMetaStream.end();
            hashStream.end();
        } );

        imageMetaStream.on( 'error', callback );
        hashStream.on( 'error', callback );
        writeStream.on( 'error', callback );

        async.parallel( [
            function( callback ) {
                if( !fileinfo.isImage ) return callback();
                gm( readStream )
                    .identify( '%w,%h,%[EXIF:Orientation]', /*{bufferStream: true},*/ function( err, data ) {
                        if( err ) return callback( err );
                        if( !data ) return callback( new Error( 'Wrong image' ) );
                        var meta = data.split( ',' );
                        fileinfo.originalWidth = meta[0];
                        fileinfo.originalHeight = meta[1];
                        fileinfo.exifOrientation = parseInt( meta[2] ) || 0;
                        callback();
                    } );
            },
            function( callback ) {
                hashStream.on( 'finish', function() {
                    fileinfo.hash = bs58.encode( new Buffer( hashStream.read(), 'hex' ) );
                    callback();
                } );
            },
            function( callback ) {
                writeStream.on( 'finish', function() {
                    callback();
                } );
            }
        ], function( err ) {
            if( err ) return callback( err );
            if( fileinfo.isImage )
            {
                fileinfo.filename = imageFilename.encode( fileinfo, true );
            }
            else
            {
                fileinfo.filename = fileinfo.hash;
            }
            callback( null, fileinfo );
        } );

        readStream.pipe( writeStream );
    }

    var queue = async.queue( function( readStream, callback ) {
        var uploadsSetting = photosetSettings.uploads,
            mimetype = mime.lookup( readStream.filename ),
            ext = path.extname( readStream.filename ).toLowerCase(),
            isImage = /^image/.test( mimetype ),
            isAllowed;

        if( isImage )
        {
            isAllowed =
                ~uploadsSetting.allowedImageTypes.indexOf( ext.replace( '.', '' ) )
                && (readStream.byteCount <= uploadsSetting.allowedImageMaxFileSize);
        }
        else
        {
            isAllowed =
                ~uploadsSetting.allowedFileTypes.indexOf( ext.replace( '.', '' ) )
                && (readStream.byteCount <= uploadsSetting.allowedFileMaxFileSize);
        }

        if( !isAllowed )
        {
            files.push( {filename: readStream.filename, error: 'invalid file type'} );
            return callback();
        }

        var remoteFile = bucket.file( 'temp-' + Date.now() ),
            writeStream = remoteFile.createWriteStream();
        streamImageTransfer( readStream, writeStream, function( err, fileinfo ) {
            if( err )
            {
                files.push( {filename: readStream.filename, error: err.message} );
                return callback;
            }
            files.push( fileinfo );
            remoteFile.move( fileinfo.filename + fileinfo.ext, callback );
        } );
    } );

    form.on( 'part', function( part ) {
        if( !part.filename ) return;
        queue.push( part );
    } );
    form.on( 'error', async.apply( http500, res ) );

    queue.drain = function() {
        async.map( files, function( fileinfo, callback ) {
            if( fileinfo.error )
            {
                return callback( null, {
                    name: fileinfo.filename,
                    url: fileinfo.error
                } );
            }
            var filename = fileinfo.filename + fileinfo.ext,
                urlFilename;
            // todo: imagePreviewMaxDimension
            if( fileinfo.isImage )
            {
                urlFilename = imageFilename.thumbnail( filename, photosetSettings.imagePreviewMaxDimension || 800 );
                urlFilename = imageFilename.autoOrientation( urlFilename, fileinfo.exifOrientation, true );
            }
            else
            {
                urlFilename = fileinfo.filename;
            }

            filenameHmac( photosetSettings.hmac.key, urlFilename + fileinfo.ext, function( err, hmac ) {
                callback( null, {
                    name: fileinfo.originalFilename,
                    url: baseUrl + '/static/' + hmac + '/' + urlFilename + '/' + fileinfo.uriFilename
                } );
            } );
        }, function( err, files ) {
            res.status( 200 ).send( req.xhr ? files : JSON.stringify( files ) );
        } );
    };

    form.parse( req );
};

Controllers.download = function( req, res ) {
    // todo: move to middleware
    if( /test\d{1,5}\.png$/.test( req.url ) )
    {
        res.writeHead( 200, {'Content-Type': 'image/png'} );
        var data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVQYV2P4DwABAQEAWk1v8QAAAABJRU5ErkJggg==';
        var buffer = new Buffer( data, 'base64' );
        return res.end( buffer );
    }
    winston.debug( 'download request', 'start' );

    var gcsSettings = module.parent.exports.settings.get( 'gcs' ),
        photosetSettings = module.parent.exports.settings.get( 'photoset' ),
        gcs = gcloud.storage( {
            projectId: gcsSettings.projectId,
            credentials: {
                client_email: gcsSettings.credentials.clientEmail,
                private_key: gcsSettings.credentials.privateKey
            }
        } ),
        bucket = gcs.bucket( gcsSettings.bucket ),
        ipw = module.parent.exports.ipw,
        urlParser = imageFilename.urlParser( req.url );

    if( !urlParser ) return http400( res );

    function validateHmac( data, callback ) {
        filenameHmac( photosetSettings.hmac.key, data.filename, function( err, hmac ) {
            if( err ) return callback( err );
            data.hmacValid = hmac === data.filenameHmac;
            winston.debug( 'download request', 'validateHmac', data.hmacValid );
            callback( null, data );
        } );
    }

    function isRemoteFileExists( data, callback ) {
        if( !data.hmacValid ) return callback( null, data );
        if( data.fileExists ) return callback( null, data ); // function used twice
        //if( !data.resizeTaskNotExists ) return callback( null, data );
        bucket.file( data.filename ).exists( function( err, fileExists ) {
            if( err ) return callback( err );
            data.fileExists = !!fileExists;
            winston.debug( 'download request', 'isRemoteFileExists', data.fileExists );
            callback( null, data );
        } );
    }

    function isResizeTaskExists( data, callback ) {
        if( data.fileExists ) return callback( null, data );
        if( !data.hmacValid ) return callback( null, data );
        if( !data.isImage ) return callback( null, data );
        db.client.HSETNX( ['plugin:photoset:resizetask', data.encodedFilename, Date.now()], function( err, reply ) {
            if( err ) return callback( err );
            data.resizeTaskExists = !reply;
            if( !data.resizeTaskExists )
            {
                winston.debug( 'download request', 'isResizeTaskExists', data.resizeTaskExists );
                return callback( null, data );
            }
            db.getObjectField( 'plugin:photoset:resizetask', data.encodedFilename, function( err, timestamp ) {
                var timeout = (Date.now() - timestamp) > 1 * 60 * 1000;
                data.resizeTaskExists = !timeout;
                winston.debug( 'download request', 'isResizeTaskExists', data.resizeTaskExists );
                callback( null, data );
            } );
        } );
    }

    function resizeRequest( data, callback ) {
        if( data.fileExists ) return callback( null, data );
        if( data.resizeTaskExists ) return callback( null, data );
        if( !data.hmacValid ) return callback( null, data );
        if( !data.isImage ) return callback( null, data );
        winston.debug( 'download request', 'resizeRequest', 'start' );
        ipw.request( {
            bucket: gcsSettings.bucket,
            filename: data.filename
        }, function( err, res ) {
            if( err ) return callback( err );
            winston.debug( 'download request', 'resizeRequest', 'end', res );
            db.deleteObjectField( 'plugin:photoset:resizetask', data.encodedFilename );
            data.fileExists = true;
            callback( null, data );
        } );
    }

    function streamResponse( data, callback ) {
        if( !data.fileExists ) return callback( null, data );
        if( !data.hmacValid ) return callback( null, data );
        winston.debug( 'download request', 'streamResponse', 'start' );
        bucket.file( data.filename ).createReadStream()
            .on( 'end', function() {
                winston.debug( 'download request', 'streamResponse', 'end' );
                callback( null, data );
            } )
            .on( 'error', callback )
            .pipe( res );
    }

    async.waterfall( [
        async.constant( {
            filename: urlParser.encodedFilename + urlParser.ext,
            filenameHmac: urlParser.filenameHmac,
            encodedFilename: urlParser.encodedFilename,
            isImage: /^image/.test( mime.lookup( urlParser.ext.replace( '.', '' ) ) )
        } ),
        validateHmac,
        isRemoteFileExists,
        isResizeTaskExists,
        resizeRequest,
        isRemoteFileExists,
        streamResponse
    ], function( err, data ) {
        if( err )
        {
            winston.error( err.stack );
            return http500( res, err );
        }

        if( !data.hmacValid ) return http403( res );
        if( !data.fileExists ) return http404( res );
        winston.debug( 'download request', 'finish' );
    } );
};

Controllers.postParser = function( post, next ) {
    var photosetSettings = module.parent.exports.settings.get( 'photoset' ),
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
            var $link = $( '<a href="' + $image.attr( 'src' ) + '" target="_blank"></a>' );
            $container.append( $link );
            $link.append( $image );

            var thumbnail = imageFilename.thumbnail( encodedFilename, photosetSettings.imageHighresMaxDimension || 1920, true );
            filenameHmac( photosetSettings.hmac.key, thumbnail + imageinfo.ext, function( err, hmac ) {
                var url = urlParser.baseUrl + hmac + '/' + thumbnail + '/' + urlParser.originalFilename + urlParser.ext;
                $image.attr( 'data-hires', url );
                callback();
            } );

        }, callback );

        $container.attr( 'data-layout', $photoset.length );

    }, function() {
        post.postData.content = $.html();

        next( null, post );
    } );
};

Controllers.postSave = function( post, next ) {
    // revert back original filename (default composer prepends it with "i + '_' + Date.now() + _" )
    post.content = post.content.replace( /(!\[)\d+_\d{13}_([^\]]+])/g, '$1$2' );
    next( null, post );
};

Controllers.postEdit = function( data, next ) {
    // revert back original filename (default composer prepends it with "i + '_' + Date.now() + _" )
    data.post.content = data.post.content.replace( /(!\[)\d+_\d{13}_([^\]]+])/g, '$1$2' );
    next( null, data );
};

module.exports = Controllers;