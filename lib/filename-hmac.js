var crypto = require( 'crypto' );

module.exports = function( key, filename, callback ) {
    var hmacStream = crypto.createHmac( 'sha1', key ).setEncoding( 'hex' );
    hmacStream.end( filename, function() {
        var hmac = hmacStream.read().slice( 16, 24 );
        callback( null, hmac );
    } );
};