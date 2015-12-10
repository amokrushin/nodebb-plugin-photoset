(function( factory ) {
    if( typeof define === 'function' && define.amd )
    {
        define( 'image-filename', factory );
    }
    else if( typeof module === 'object' && module.exports )
    {
        module.exports = factory();
    }
}( function() {

        'use strict';

        var imageFilename = {};

        var FORMAT_VERSION = '2';

        var base58 = (function() {
            /**
             * @url https://gist.github.com/inflammable/2929362
             */
            var bs58 = (function( alphabet ) {
                var base = alphabet.length;
                return {
                    encode: function( enc ) {
                        if( typeof enc !== 'number' || enc !== parseInt( enc ) )
                            throw '"encode" only accepts integers.';
                        var encoded = '';
                        while( enc )
                        {
                            var remainder = enc % base;
                            enc = Math.floor( enc / base );
                            encoded = alphabet[remainder].toString() + encoded;
                        }
                        return encoded;
                    },
                    decode: function( dec ) {
                        if( typeof dec !== 'string' )
                            throw '"decode" only accepts strings.';
                        var decoded = 0;
                        while( dec )
                        {
                            var alphabetPosition = alphabet.indexOf( dec[0] );
                            if( alphabetPosition < 0 )
                                throw '"decode" can\'t find "' + dec[0] + '" in the alphabet: "' + alphabet + '"';
                            var powerOf = dec.length - 1;
                            decoded += alphabetPosition * (Math.pow( base, powerOf ));
                            dec = dec.substring( 1 );
                        }
                        return decoded;
                    }
                };
            })( '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz' );

            return {
                encode: function( num, fixedLength ) {
                    var b58 = bs58.encode( parseInt( num ) );
                    if( !fixedLength ) return b58;
                    if( b58.length > fixedLength ) return new Error( 'number length is more than required' );
                    while( b58.length < fixedLength ) b58 = '1' + b58;
                    return b58;
                },
                decode: function( b58 ) {
                    return bs58.decode( b58 );
                }
            }
        })();


        imageFilename.decode = function( filename ) {
            var reL1 = /(\w+)(\w)(-o[\w-]*)(\.\w{3,4})?$/,
                reL2 = /-(o|t|r|f)(\w*)/g,
                reL3,
                fileinfo = {},
                matchL1, matchL2, matchL3;

            matchL1 = filename.match( reL1 );
            if( !matchL1 || matchL1.length !== 5 ) return null;
            if( !matchL1[2] ) return null;
            if( matchL1[2] !== FORMAT_VERSION ) return null;

            fileinfo.hash = matchL1[1];
            fileinfo.ext = matchL1[4];

            while( (matchL2 = reL2.exec( matchL1[3] )) !== null )
            {
                switch( matchL2[1] )
                {
                    case 'o':
                        reL3 = new RegExp( '.{1,' + matchL2[2].length / 2 + '}', 'g' );
                        matchL3 = matchL2[2].match( reL3 );
                        fileinfo.originalWidth = base58.decode( matchL3[0] );
                        fileinfo.originalHeight = base58.decode( matchL3[1] );
                        break;
                    case 't':
                        reL3 = new RegExp( '.{1,' + matchL2[2].length / 2 + '}', 'g' );
                        matchL3 = matchL2[2].match( reL3 );
                        fileinfo.width = base58.decode( matchL3[0] );
                        fileinfo.height = base58.decode( matchL3[1] );
                        break;
                    case 'r':
                        fileinfo.rotation = base58.decode( matchL2[2] );
                        break;
                    case 'f':
                        fileinfo.flip = true;
                        break;
                }
            }
            return fileinfo;
        };

        imageFilename.encode = function( fileinfo, withoutExt ) {
            if( !(fileinfo.hash && fileinfo.ext && fileinfo.originalWidth && fileinfo.originalHeight) )
            {
                return null;
            }

            var filename = [],
                fixedLength;

            filename.push( fileinfo.hash, FORMAT_VERSION );
            if( fileinfo.originalWidth && fileinfo.originalHeight )
            {
                fixedLength = fileinfo.originalWidth > 3363 || fileinfo.originalHeight > 3363 ? 3 : 2;
                filename.push( '-o',
                    base58.encode( fileinfo.originalWidth, fixedLength ),
                    base58.encode( fileinfo.originalHeight, fixedLength )
                );
            }
            if( fileinfo.width && fileinfo.height )
            {
                fixedLength = fileinfo.width > 3363 || fileinfo.height > 3363 ? 3 : 2;
                filename.push( '-t',
                    base58.encode( fileinfo.width, fixedLength ),
                    base58.encode( fileinfo.height, fixedLength )
                );
            }
            if( fileinfo.rotation )
            {
                filename.push( '-r',
                    base58.encode( fileinfo.rotation )
                );
            }
            if( fileinfo.flip )
            {
                filename.push( '-f' );
            }
            if( !withoutExt )
            {
                filename.push( fileinfo.ext );
            }

            return filename.join( '' );
        };

        imageFilename.original = function( filename, withoutExt ) {
            var imageinfo = imageFilename.decode( filename );
            return imageFilename.encode( {
                hash: imageinfo.hash,
                ext: imageinfo.ext,
                originalWidth: imageinfo.originalWidth,
                originalHeight: imageinfo.originalHeight
            }, withoutExt );
        };

        imageFilename.thumbnail = function( filename, maxDimension, withoutExt ) {
            var imageinfo = imageFilename.decode( filename ),
                aspectRatio = imageinfo.width && imageinfo.height
                    ? imageinfo.width / imageinfo.height
                    : imageinfo.originalWidth / imageinfo.originalHeight;
            imageinfo.width = aspectRatio > 1 ? maxDimension : parseInt( maxDimension * aspectRatio );
            imageinfo.height = aspectRatio > 1 ? parseInt( maxDimension / aspectRatio ) : maxDimension;
            return imageFilename.encode( imageinfo, withoutExt );
        };

        imageFilename.autoOrientation = function( filename, exifOrientation, withoutExt ) {
            var imageinfo = imageFilename.decode( filename ),
                w = imageinfo.width,
                h = imageinfo.height;
            /*
             exif orientation
             N  | rotation cw | rotation code | flip-x
             1  |       0     |       0       |   no
             2  |       0     |       0       |   yes
             6  |      90     |       1       |   no
             5  |      90     |       1       |   yes
             3  |     180     |       2       |   no
             4  |     180     |       2       |   yes
             8  |     270     |       3       |   no
             7  |     270     |       3       |   yes
             */

            switch( exifOrientation )
            {
                case 2:
                    imageinfo.flip = true;
                    break;
                case 6:
                    imageinfo.rotation = 90;
                    imageinfo.flip = false;
                    break;
                case 5:
                    imageinfo.rotation = 90;
                    imageinfo.flip = true;
                    break;
                case 3:
                    imageinfo.rotation = 180;
                    imageinfo.flip = false;
                    break;
                case 4:
                    imageinfo.rotation = 180;
                    imageinfo.flip = true;
                    break;
                case 8:
                    imageinfo.rotation = 270;
                    imageinfo.flip = false;
                    break;
                case 7:
                    imageinfo.rotation = 270;
                    imageinfo.flip = true;
                    break;
            }

            imageinfo.width = imageinfo.rotation % 180 ? h : w;
            imageinfo.height = imageinfo.rotation % 180 ? w : h;

            return imageFilename.encode( imageinfo, withoutExt );
        };

        imageFilename.urlParser = function( url ) {
            /* https://regex101.com/r/yU1oN3/4 */
            var re = new RegExp( '(.+\/)([0-9A-Za-z]{8})\/([0-9A-Za-z]+'
                    + FORMAT_VERSION
                    + '-o[-0-9A-Za-z]+)\\/([^\\/]+)(\\.[a-z]{2,4})$' ),
                urlParser = url.match( re );
            if( !urlParser ) return null;

            return {
                baseUrl: urlParser[1],
                filenameHmac: urlParser[2],
                encodedFilename: urlParser[3],
                originalFilename: urlParser[4],
                ext: urlParser[5]
            };
        };

        return imageFilename;
    }
))
;