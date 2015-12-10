var crypto = require( 'crypto' ),
    bs58 = require( 'bs58' );

module.exports = function( key, filename, callback ) {
    var hmacStream = crypto.createHmac( 'sha1', key ).setEncoding( 'hex' );
    hmacStream.end( filename, function() {
        var hmac = bs58.encode( new Buffer( hmacStream.read(), 'hex' ) ).slice( 16, 24 );
        callback( null, hmac );
    } );
};