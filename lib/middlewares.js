var jwt = require( 'jsonwebtoken' ),
    middlewares = {};

middlewares.apiKey = function( req, res, next ) {
    var token = req.headers.authorization,
        jwtPayload = token ? jwt.decode( token ) : null,
        apiKeyId = jwtPayload ? jwtPayload.apiKeyId : null;

    if( !token || !jwtPayload || !apiKeyId )
    {
        res.status( 401 );
        return res.end( 'blmh' );
    }

    function findApiKey( apiKeyId, callback ) {
        var apiKeys = module.parent.exports.settings.get( 'irw.apiKeys' ) || [];
        for( var i = 0; i < apiKeys.length; i++ )
        {
            if( apiKeys[i].slice( 0, 40 ) === apiKeyId ) return callback( null, apiKeys[i] );
        }
        return callback();
    }

    findApiKey( apiKeyId, function( err, apiKey ) {
        if( !apiKey )
        {
            res.status( 401 );
            return res.end( 'ipdq' );
        }
        jwt.verify( token, apiKey.slice( 40, 80 ), function( err ) {
            if( err )
            {
                res.status( 401 );
                return res.end( 'n5fh' );
            }
            next();
        } );
    } );
};

module.exports = middlewares;