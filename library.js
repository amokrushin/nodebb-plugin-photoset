"use strict";

var controllers = require( './lib/controllers' ),
    middlewares = require( './lib/middlewares' ),
    SocketPlugins = require.main.require( './src/socket.io/plugins' ),
    async = require.main.require( 'async' ),
    winston = require.main.require( 'winston' ),
    request = require.main.require( 'request' ),
    Settings = module.parent.require( './settings' ),
    user = require.main.require( './src/user' ),
    db = require.main.require( './src/database' ),
    _ = require( 'lodash' ),
    gcloud = require( 'gcloud' ),
    rmq = require( 'am-rmq' )( winston ),
    ipw = require( './lib/ipw' )( rmq ),
    Plugin = {},
    app,
    npmPackage = require( './package.json' );

Plugin.settings = {};

Plugin.ipw = ipw;

Plugin.status = {
    redis: {},
    gcs: {},
    rmq: {},
    ipw: {
        workers: {},
        updateTriggeredAt: 0
    },
    proxyCache: {},
    photoset: {}
};

function initSettings( callback ) {
    var defaultSettings = {
        gcs: {
            projectId: '',
            credentials: {
                clientEmail: '',
                privateKey: ''
            },
            bucket: ''
        },
        rmq: {
            host: '',
            user: '',
            password: '',
            vhost: ''
        },
        ipw: {
            version: '0.2.0',
            transport: 'rmq',
            apiKeys: []
        },
        photoset: {
            hmac: {
                key: ''
            }
        }
    };

    // note: nodebb settings module breaks arrays after version change, so settings version is not used
    var settings = new Settings( 'photoset', '0', defaultSettings, function() {
        settings.set( 'plugin.version', npmPackage.version );
        settings.set( 'ipw.version', defaultSettings.ipw.version );
        if( !settings.get( 'photoset.hmac.key' ) )
        {
            var hmacKey = require( 'crypto' ).randomBytes( 64 ).toString( 'hex' );
            settings.set( 'photoset.hmac.key', hmacKey );
        }
        settings.persist( function() {
            callback( settings );
        } );
    }, false );
}


Plugin.init = function( params, callback ) {
    var router = params.router,
        hostMiddleware = params.middleware;

    router.get( '/admin/plugins/photoset', hostMiddleware.admin.buildHeader, controllers.renderAdminPage );
    router.get( '/api/admin/plugins/photoset', controllers.renderAdminPage );
    router.get( '/api/plugins/photoset/settings', middlewares.apiKey, controllers.ipwSettings );

    router.get( '/static/*', controllers.download );


    /* override default nodebb uploads route */
    router.post( '/api/post/upload', hostMiddleware.applyCSRF, controllers.upload );

    initSettings( function( settings ) {
        Plugin.settings = settings;
        if( settings.get( 'rmq.host' ) && settings.get( 'rmq.user' ) && settings.get( 'rmq.password' ) )
        {
            rmq.connect( settings.get( 'rmq' ), true );
        }
        callback();
    } );

    db.getObjectField( 'plugin:photoset', 'status', function( err, status ) {
        if( err ) return callback( err );
        if( status )
        {
            Plugin.status = JSON.parse( status );
        }
        else
        {
            db.setObjectField( 'plugin:photoset', 'status', JSON.stringify( Plugin.status ), function( err ) {
                if( err ) return callback( err );
            } );
        }
    } );
};


Plugin.parse = controllers.postParser;
Plugin.postSave = controllers.postSave;
Plugin.postEdit = controllers.postEdit;

Plugin.addAdminNavigation = function( header, callback ) {
    header.plugins.push( {
        route: '/plugins/photoset',
        icon: 'fa-tint',
        name: 'Photoset'
    } );

    callback( null, header );
};


Plugin.updateStatus = function( modules, callback ) {
    function redisStatus( callback ) {
        if( db.client.HLEN && db.client.HSETNX )
        {
            Plugin.status.redis = {success: true};
        }
        else
        {
            Plugin.status.redis = {success: false};
        }
        callback();
    }

    function gcsStatus( callback ) {
        var settings = Plugin.settings.get( 'gcs' ),
            gcs;

        Plugin.status.gcs.success = false;
        Plugin.status.gcs.connection = false;
        Plugin.status.gcs.message = '';

        if( !settings.projectId || !settings.credentials.clientEmail || !settings.credentials.privateKey )
        {
            Plugin.status.gcs.message = 'Not configured';
            return callback();
        }

        gcs = gcloud.storage( {
            projectId: settings.projectId,
            credentials: {
                client_email: settings.credentials.clientEmail,
                private_key: settings.credentials.privateKey
            }
        } );

        // todo: projectId not verified
        gcs.bucket( Date.now().toString() ).getMetadata( function( err ) {
            if( err && err.code === 404 )
            {
                Plugin.status.gcs.connection = true;
                if( settings.bucket )
                {
                    Plugin.status.gcs.success = true;
                    return callback();
                }
            }
            Plugin.status.gcs.message = 'Bucket not selected';
            if( err && err.code !== 404 ) Plugin.status.gcs.message = err.message;
            if( ~Plugin.status.gcs.message.indexOf( 'PEM' ) ) Plugin.status.gcs.message = 'Invalid private key';
            if( ~Plugin.status.gcs.message.indexOf( 'KEY' ) ) Plugin.status.gcs.message = 'Invalid private key';
            if( ~Plugin.status.gcs.message.indexOf( 'invalid_grant' ) ) Plugin.status.gcs.message = 'Invalid client email';
            callback();
        } );
    }

    function rmqStatus( callback ) {
        var settings = Plugin.settings.get( 'rmq' ),
            gcs;

        Plugin.status.rmq.success = false;
        Plugin.status.rmq.message = '';

        if( !settings.host || !settings.user || !settings.password )
        {
            Plugin.status.rmq.message = 'Not configured';
            return callback();
        }

        rmq.connect( settings, false, function( err ) {
            if( err )
            {
                return callback();
            }
            Plugin.status.rmq.success = true;
            callback();
        } );
    }

    function ipwStatus( callback ) {
        if( !Plugin.status.rmq.success )
        {
            Plugin.status.ipw.message = 'RabbitMQ required';
            return callback();
        }

        Plugin.status.ipw.success = false;
        Plugin.status.ipw.updateRequired = false;
        Plugin.status.ipw.updateInProgress = false;
        Plugin.status.ipw.message = '';

        function triggerWorkersUpdate() {
            if( (Date.now() - Plugin.status.ipw.updateTriggeredAt) > 5 * 60 * 1000 )
            {
                Plugin.status.ipw.updateTriggeredAt = Date.now();
                ipw.update( Plugin.settings.get( 'ipw.version' ) );
            }
        }

        ipw.discovery( function( err, data ) {
            var activeWorkers = _.indexBy( data, 'uuid' ),
                storedWorkers = _.indexBy( Plugin.status.ipw.workers, 'uuid' ),
                workers;

            _.forEach( activeWorkers, function( worker ) {
                worker.status = 'active';
                if( worker.version !== Plugin.settings.get( 'ipw.version' ) )
                {
                    worker.status = 'updating';
                    worker.updateStartedAt = Date.now();
                    Plugin.status.ipw.updateRequired = true;
                }
            } );

            _.forEach( storedWorkers, function( worker ) {
                if( worker.status === 'active' ) worker.status = 'inactive';
                if( worker.updateStartedAt )
                {
                    if( Date.now() > worker.updateStartedAt + 2 * 60 * 1000 )
                    {
                        worker.status = 'fail';
                    }
                }
            } );

            workers = _.assign( {}, storedWorkers, activeWorkers );

            _.forEach( workers, function( worker ) {
                if( worker.status === 'updating' ) Plugin.status.ipw.updateInProgress = true;
            } );

            Plugin.status.ipw.workers = _.sortByOrder( _.values( workers ), ['startedAt'], ['desc'] );
            Plugin.status.ipw.success = !!Plugin.status.ipw.workers.length;

            if( Plugin.status.ipw.updateRequired ) triggerWorkersUpdate();

            return callback();
        } );
    }

    function proxyCacheStatus( callback ) {
        var imageId = parseInt( Date.now() / 1000 / 60 / 60 / 24 ) - 400,
            url = 'http://community-dev.steelcar.ru/static/test' + imageId + '.png';

        async.retry( 2,
            function( callback ) {
                request( url, function( err, response ) {
                    if( err ) return callback( err );
                    if( response.statusCode !== 200 ) return callback( new Error( 'HTTP' + response.statusCode ) );
                    var xProxyCache = response.headers['x-proxy-cache'];
                    if( !xProxyCache ) return callback( new Error( 'Proxy cache unconfigured' ) );
                    if( xProxyCache === 'MISS' ) return callback( new Error( 'Proxy cache MISS' ) );
                    if( xProxyCache === 'HIT' ) return callback();
                    callback( new Error( 'Unknown "x-proxy-cache" header value' ) );
                } );
            },
            function( err ) {
                Plugin.status.proxyCache = {success: !err, message: err ? err.message : ''};
                callback();
            } );
    }

    function photosetStatus( callback ) {
        Plugin.status.photoset.success = Plugin.status.gcs.success
            && Plugin.status.rmq.success
            && Plugin.status.ipw.success;
        //if( Plugin.status.photoset.success && !Plugin.status.photoset.active )
        //{
        //    Plugin.status.photoset.active = true;
        //    Plugin.start();
        //}
        callback();
    }

    function saveStatus( callback ) {
        db.setObjectField( 'plugin:photoset', 'status', JSON.stringify( Plugin.status ), callback );
    }

    Plugin.settings.sync( function() {
        async.parallel( [
            !modules || ~modules.indexOf( 'redis' ) ? redisStatus : async.constant(),
            !modules || ~modules.indexOf( 'gcs' ) ? gcsStatus : async.constant(),
            !modules || ~modules.indexOf( 'rmq' ) ? rmqStatus : async.constant(),
            !modules || ~modules.indexOf( 'proxyCache' ) ? proxyCacheStatus : async.constant()
        ], async.apply( async.series, [
            !modules || ~modules.indexOf( 'ipw' ) ? ipwStatus : async.constant(),
            !modules || ~modules.indexOf( 'photoset' ) ? photosetStatus : async.constant(),
            saveStatus
        ], callback ) );
    } );
};

/*
 WebSocket methods
 */
SocketPlugins.photoset = {};

SocketPlugins.photoset.status = function( socket, module, callback ) {
    Plugin.updateStatus( module, function() {
        callback( null, Plugin.status );
    } );
};

SocketPlugins.photoset.syncSettings = function( socket, data, callback ) {
    Plugin.settings.sync( callback );
};

SocketPlugins.photoset.apiKeyNew = function( socket, data, callback ) {
    require( 'crypto' ).randomBytes( 40, function( ex, buf ) {
        var apiKey = buf.toString( 'hex' ),
            apiKeys = Plugin.settings.get( 'irw.apiKeys' ) || [];
        apiKeys.push( apiKey );
        Plugin.settings.set( 'irw.apiKeys', apiKeys );
        Plugin.settings.persist( function() {
            callback( null, apiKey );
        } );
    } );
};

SocketPlugins.photoset.apiKeyRemove = function( socket, apiKey, callback ) {
    var apiKeys = Plugin.settings.get( 'irw.apiKeys' ) || [];
    _.remove( apiKeys, function( item ) {
        return !item || item === apiKey;
    } );
    Plugin.settings.set( 'irw.apiKeys', apiKeys );
    Plugin.settings.persist( callback );
};

SocketPlugins.photoset.gcsBuckets = function( socket, data, callback ) {
    var settings = Plugin.settings.get( 'gcs' ),
        gcs = gcloud.storage( {
            projectId: settings.projectId,
            credentials: {
                client_email: settings.credentials.clientEmail,
                private_key: settings.credentials.privateKey
            }
        } );

    gcs.getBuckets( function( err, res ) {
        if( err ) return callback( err );
        var buckets = res.map( function( bucket ) {
            return bucket.metadata.name;
        } );
        callback( null, buckets );
    } );
};

//Plugin.parse = function( post, next ) {
//    next( null, post );
//};
//Plugin.postSave = function( post, next ) {
//    next( null, post );
//};
//Plugin.postEdit = function( data, next ) {
//    next( null, data );
//};

module.exports = Plugin;