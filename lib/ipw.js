"use strict";

module.exports = function( rmq ) {
    var ipw = {};

    ipw.discovery = function( callback ) {
        rmq.broadcast( 'ipw.discovery', {timeout: 1000}, {}, function( workers ) {
            callback( null, workers );
        } );
    };

    ipw.update = function( requiredVersion ) {
        rmq.broadcast( 'ipw.update', {}, {requiredVersion: requiredVersion} );
    };

    ipw.request = function( data, callback ) {
        rmq.queue( 'ipw.request', {}, data, function( res ) {
            callback( null, res );
        } );
    };

    return ipw;
};