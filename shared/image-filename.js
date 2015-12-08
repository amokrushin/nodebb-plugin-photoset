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

        var FORMAT_VERSION = '1';

        imageFilename.decode = function( filename ) {
            var reL1 = /(\w{32})(\w?)([\w-]*)(\.\w{3,4})?$/,
                reL2 = /-(o|w|h|r|c|eo|fl)([a-f0-9]*)/g,
                fileinfo = {},
                matchL1, matchL2, matchL3;

            matchL1 = filename.toLowerCase().match( reL1 );
            if( !matchL1 || matchL1.length !== 5 )
            {
                return new Error( 'Wrong filename' );
            }
            if( matchL1[2] && matchL1[2] > FORMAT_VERSION )
            {
                return new Error( 'Unsupported filename format' );
            }
            fileinfo.hash = matchL1[1];
            fileinfo.ext = matchL1[4];

            while( (matchL2 = reL2.exec( matchL1[3] )) !== null )
            {
                switch( matchL2[1] )
                {
                    case 'o':
                        matchL3 = matchL2[2].match( /.{1,4}/g );
                        fileinfo.originalWidth = parseInt( matchL3[0], 16 );
                        fileinfo.originalHeight = parseInt( matchL3[1], 16 );
                        break;
                    case 'eo':
                        fileinfo.exifOrientation = parseInt( matchL2[2] );
                        break;
                    case 'w':
                        fileinfo.width = parseInt( matchL2[2], 16 );
                        break;
                    case 'h':
                        fileinfo.height = parseInt( matchL2[2], 16 );
                        break;
                    case 'r':
                        fileinfo.rotation = parseInt( matchL2[2], 16 );
                        break;
                    case 'fl':
                        fileinfo.flip = true;
                        break;
                    // future usage
                    /*case 'c':
                     matchL3 = matchL2[2].match( /.{1,2}/g );
                     fileinfo.cropLeft = parseInt( matchL3[0], 16 );
                     fileinfo.cropTop = parseInt( matchL3[1], 16 );
                     break;
                     */
                }
            }
            return fileinfo;
        };

        imageFilename.encode = function( fileinfo, withoutExt ) {
            if( !(fileinfo.hash && fileinfo.ext && fileinfo.originalWidth && fileinfo.originalWidth) )
            {
                return new Error( 'hash, ext, originalWidth, originalHeight should be set' );
            }

            function toHexString( i, c ) {
                var s = parseInt( i ).toString( 16 );
                while( s.length < c ) s = '0' + s;
                return s;
            }

            var filename = [];
            filename.push( fileinfo.hash, FORMAT_VERSION );
            if( fileinfo.originalWidth && fileinfo.originalHeight )
            {
                filename.push( '-o',
                    toHexString( fileinfo.originalWidth, 4 ),
                    toHexString( fileinfo.originalHeight, 4 )
                );
            }
            if( fileinfo.width && fileinfo.height )
            {
                filename.push( '-w',
                    toHexString( fileinfo.width, 3 )
                );
                filename.push( '-h',
                    toHexString( fileinfo.height, 3 )
                );
            }
            if( fileinfo.exifOrientation )
            {
                filename.push( '-eo',
                    fileinfo.exifOrientation
                );
            }
            if( fileinfo.rotation )
            {
                filename.push( '-r',
                    toHexString( fileinfo.rotation, 3 )
                );
            }
            if( fileinfo.flip )
            {
                filename.push( '-fl' );
            }
            if( fileinfo.cropLeft && fileinfo.cropTop )
            {
                filename.push( '-c',
                    toHexString( fileinfo.cropLeft, 2 ),
                    toHexString( fileinfo.cropTop, 2 )
                );
            }
            if( !withoutExt )
            {
                filename.push( fileinfo.ext );
            }

            return filename.join( '' );
        };

        function extend( object, source ) {
            for( var prop in source )
            {
                if( !source.hasOwnProperty( prop ) ) continue;
                object[prop] = source[prop];
            }
        }

        imageFilename.replace = function( filename, replaceWith, withoutExt ) {
            var imageinfo = imageFilename.decode( filename );
            extend( imageinfo, replaceWith );
            return imageFilename.encode( imageinfo, withoutExt );
        };

        imageFilename.original = function( filename, withoutExt ) {
            var imageinfo = imageFilename.decode( filename );
            return imageFilename.encode( {
                hash: imageinfo.hash,
                ext: imageinfo.ext,
                originalWidth: imageinfo.originalWidth,
                originalHeight: imageinfo.originalHeight,
                exifOrientation: imageinfo.exifOrientation || null
            }, withoutExt );
        };

        imageFilename.thumbnail = function( filename, maxDimension, withoutExt ) {
            var imageinfo = imageFilename.decode( filename ),
                aspectRatio = imageinfo.originalWidth / imageinfo.originalHeight,
                w = aspectRatio > 1 ? maxDimension : parseInt( maxDimension * aspectRatio ),
                h = aspectRatio > 1 ? parseInt( maxDimension / aspectRatio ) : maxDimension;

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

            switch( imageinfo.exifOrientation )
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
            var urlParser = url.match( /(.+\/)[a-z0-9]+\/([-0-9a-z.]+)\/([^\/]+)(\.[a-z]{2,4})$/ );
            if( !urlParser ) return null;
            return {
                baseUrl: urlParser[1],
                encodedFilename: urlParser[2],
                originalFilename: urlParser[3],
                ext: urlParser[4]
            };
        };

        return imageFilename;
    }
))
;