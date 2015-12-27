var winston = require( 'winston' );

var logger = new (winston.Logger)( {
    transports: [
        new (winston.transports.Console)( {
            formatter: function( options ) {
                var timestamp = new Date().toISOString().replace( /T/, ' ' ).replace( /\..+/, '' ),
                    pid = process.pid;
                return timestamp
                    + ' [' + pid + '] - ' + options.level + ': '
                    + (undefined !== options.message ? options.message : '')
                    + (options.meta && Object.keys( options.meta ).length
                        ? '\n\t' + JSON.stringify( options.meta ) : '');
            }
        } )
    ]
} );

module.exports = logger;