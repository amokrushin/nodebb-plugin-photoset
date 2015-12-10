'use strict';
/*global require*/

var assert = require( 'assert' ),
    imageFilename = require( './../shared/image-filename' );


describe( 'Image Filename', function() {
    describe( 'base encoding and decoding', function() {
        var test = [
            {
                filename: 'JCo1T9Zk6nd2woArdmcUj12-o2YP22b',
                ext: '.jpg',
                imageinfo: {
                    ext: ".jpg",
                    hash: "JCo1T9Zk6nd2woArdmcUj1",
                    originalWidth: 5184,
                    originalHeight: 3456
                }
            }, {
                filename: 'JCo1T9Zk6nd2woArdmcUj12-o2YP22b-ta7P5-r5f-f',
                ext: '.jpg',
                imageinfo: {
                    ext: ".jpg",
                    hash: "JCo1T9Zk6nd2woArdmcUj1",
                    originalWidth: 5184,
                    originalHeight: 3456,
                    width: 1920,
                    height: 1280,
                    rotation: 270,
                    flip: true
                }
            }
        ];
        test.forEach( function( t, i ) {
            it( 'should decode image filename #' + i, function() {
                assert.deepEqual( imageFilename.decode( t.filename + t.ext ), t.imageinfo, 'matches' );
            } );
            it( 'should encode imageinfo object to filename #' + i, function() {
                assert.equal( imageFilename.encode( t.imageinfo ), t.filename + t.ext, 'matches' );
            } );
        } );

    } );
    describe( 'thumbnail', function() {
        /**
         { originalFilename: 'yxtoe0yl557e39f1a3b91-c000064-r000-a0302-w780.jpg',
          uriFilename: 'yxtoe0yl557e39f1a3b91-c000064-r000-a0302-w780.jpg',
          ext: '.jpg',
          hash: 'wSxdRu5Xi5BnTx8zpwhan',
          originalWidth: '1920',
          originalHeight: '1280',
          exifOrientation: 1,
          filename: 'wSxdRu5Xi5BnTx8zpwhan2-oa7P5' }
         */
        var test = [
            {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o2YP22b.jpg',
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o2YP22b-ta7P5.jpg'
            },
            {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP.jpg',
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg'
            },
            {
                sourceFilename: 'R1QDEPHHyZEibbqdA8WG5D2-oBM8m-t9HC3-r5f.jpg',
                targetFilename: 'R1QDEPHHyZEibbqdA8WG5D2-oBM8m-tRqa7-r5f.jpg'
            },
            {
                sourceFilename: 'wSxdRu5Xi5BnTx8zpwhan2-oa7P5.jpg',
                targetFilename: 'wSxdRu5Xi5BnTx8zpwhan2-oa7P5-ta7P5.jpg'
            }
        ];
        test.forEach( function( t, i ) {
            it( 'should make thumbnail filename from image original filename #' + i, function() {
                assert.equal( imageFilename.thumbnail( t.sourceFilename, 1920 ), t.targetFilename, 'matches' );
            } );
        } );
    } );
    describe( 'original', function() {
        it( 'should return original image filename from thumbnail filename', function() {
            var sourceFilename = 'JCo1T9Zk6nd2woArdmcUj12-o2YP22b-ta7P5-r5f-f.jpg',
                targetFilename = 'JCo1T9Zk6nd2woArdmcUj12-o2YP22b.jpg';

            assert.equal( imageFilename.original( sourceFilename ), targetFilename, 'matches' );
        } );
    } );
    describe( 'auto orientation', function() {

        var test = [
            {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg',
                exifOrintation: 1,
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg'
            }, {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg',
                exifOrintation: 2,
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7-f.jpg'
            }, {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg',
                exifOrintation: 3,
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7-r47.jpg'
            }, {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg',
                exifOrintation: 4,
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7-r47-f.jpg'
            }, {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg',
                exifOrintation: 5,
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-ta7P5-r2Z-f.jpg'
            }, {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg',
                exifOrintation: 6,
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-ta7P5-r2Z.jpg'
            }, {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-tP5a7.jpg',
                exifOrintation: 7,
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o22b2YP-ta7P5-r5f-f.jpg'
            }, {
                sourceFilename: 'JCo1T9Zk6nd2woArdmcUj12-o2YP22b-ta7P5.jpg',
                exifOrintation: 8,
                targetFilename: 'JCo1T9Zk6nd2woArdmcUj12-o2YP22b-tP5a7-r5f.jpg'
            }
        ];
        test.forEach( function( t ) {
            it( 'should make thumbnail filename from image original filename', function() {
                assert.equal( imageFilename.autoOrientation( t.sourceFilename, t.exifOrintation ), t.targetFilename, 'matches' );
            } );
        } );
    } );
    describe( 'url parser', function() {

        var test = [
            {
                url: 'http://localhost:4567/static/360bebc8/87b93c42061641ae2df54d2-oBM8m-tC39H/landscape_1.jpg',
                result: {
                    baseUrl: 'http://localhost:4567/static/',
                    encodedFilename: '87b93c42061641ae2df54d2-oBM8m-tC39H',
                    ext: '.jpg',
                    filenameHmac: '360bebc8',
                    originalFilename: 'landscape_1'
                }
            }
        ];
        test.forEach( function( t ) {
            it( 'should return parser url', function() {
                assert.deepEqual( imageFilename.urlParser( t.url ), t.result, 'matches' );
            } );
        } );
    } );
} );