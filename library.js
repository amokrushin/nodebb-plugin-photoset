"use strict";

var controllers = require( './lib/controllers' ),
    SocketPlugins = require.main.require( './src/socket.io/plugins' ),
    async = module.parent.require( 'async' ),
    meta = module.parent.require( './meta' ),
    _ = require( 'lodash' ),
    gcloud = require( 'gcloud' ),
    Plugin = {},
    app;


Plugin.settings = {};

Plugin.init = function( params, callback ) {
    var router = params.router,
        hostMiddleware = params.middleware;

    app = params.app;
    router.get( '/admin/plugins/photoset', hostMiddleware.admin.buildHeader, controllers.renderAdminPage );
    router.get( '/api/admin/plugins/photoset', controllers.renderAdminPage );

    router.get( '/static/*', controllers.download );

    /* override default nodebb uploads route */
    router.post( '/api/post/upload', hostMiddleware.applyCSRF, controllers.upload );

    meta.settings.get( 'photoset', function( err, settings ) {
        if( !settings.hmacKey )
        {
            var hmacKey = require( 'crypto' ).randomBytes( 64 ).toString( 'hex' );
            meta.settings.setOne( 'photoset', 'hmacKey', hmacKey );
            settings.hmacKey = hmacKey;
        }
        Plugin.settings = settings;
        callback();
    } );
};


Plugin.addAdminNavigation = function( header, callback ) {
    header.plugins.push( {
        route: '/plugins/photoset',
        icon: 'fa-tint',
        name: 'Photoset'
    } );

    callback( null, header );
};

/*
 WebSocket methods
 */
SocketPlugins.photoset = {};

SocketPlugins.photoset.gcsConnect = function( socket, data, callback ) {
    var config = {
        projectId: data.projectId,
        credentials: {
            clientEmail: data.clientEmail,
            privateKey: data.privateKey
        }
    };

    var gcs = gcloud.storage( config );

    gcs.getBuckets( function( err, res ) {
        if( err )
        {
            return callback( null, {success: false, message: err.message} );
        }

        var buckets = res.map( function( bucket ) {
            return {name: bucket.metadata.name};
        } );

        meta.settings.setOne( 'photoset', 'buckets', JSON.stringify( buckets ) );

        callback( null, {
            success: true,
            buckets: buckets
        } );
    } );

};

Plugin.parse = controllers.postParser;

Plugin.postSave = function( post, next ) {
    // revert back original filename (default composer prepends it with "i + '_' + Date.now() + _" )
    post.content = post.content.replace( /(!\[)\d+_\d{13}_([^\]]+])/g, '$1$2' );
    next( null, post );
};

Plugin.postEdit = function( data, next ) {
    // revert back original filename (default composer prepends it with "i + '_' + Date.now() + _" )
    data.post.content = data.post.content.replace( /(!\[)\d+_\d{13}_([^\]]+])/g, '$1$2' );
    next( null, data );
};

Plugin.embedPhotoswipe = function( data, callback ) {
    app.render( 'photoswipe', function( err, parsedTemplate ) {
        if( !data.res.locals.footer ) return callback( null, data );
        data.res.locals.footer = data.res.locals.footer.replace( '</body>', parsedTemplate + '</body>' );

        callback( null, data );
    } );
};

module.exports = Plugin;