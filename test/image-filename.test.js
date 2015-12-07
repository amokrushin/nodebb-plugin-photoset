'use strict';
/*global require*/

var assert = require( 'assert' ),
    imageFilename = require( './../shared/image-filename' );


describe( 'Image Filename', function() {
    describe( 'decode', function() {
        it( 'decoding', function() {
            var filename = '8b58d54b86c4ccd44a0e4172e240a047-o07800500-w280-h1aa.jpg';
            assert.deepEqual( imageFilename.decode( filename ), {
                ext: ".jpg",
                hash: "8b58d54b86c4ccd44a0e4172e240a047",
                originalHeight: 1280,
                originalWidth: 1920,
                width: 640,
                height: 426
            }, 'matches' );
        } );
    } );
    describe( 'encode', function() {
        var filename = '8b58d54b86c4ccd44a0e4172e240a047-o07800500-w280-h1aa';
        var ext = '.jpg';
        it( 'should encode imageinfo object to filename', function() {
            assert.equal( imageFilename.encode( {
                ext: ".jpg",
                hash: "8b58d54b86c4ccd44a0e4172e240a047",
                originalHeight: 1280,
                originalWidth: 1920,
                width: 640,
                height: 426
            } ), filename + ext, 'matches' );
        } );
        it( 'should return filename without extension', function() {
            assert.equal( imageFilename.encode( {
                ext: ".jpg",
                hash: "8b58d54b86c4ccd44a0e4172e240a047",
                originalHeight: 1280,
                originalWidth: 1920,
                width: 640,
                height: 426
            }, true ), filename, 'matches' );
        } );
    } );
    describe( 'replace', function() {
        it( 'should replace width and height info in filename', function() {
            var sourceFilename = '8b58d54b86c4ccd44a0e4172e240a047-o07800500-w280-h1aa.jpg';
            var targetFilename = '8b58d54b86c4ccd44a0e4172e240a047-o07800500-w190-h0c8.jpg';
            assert.equal( imageFilename.replace( sourceFilename, {
                width: 400,
                height: 200
            } ), targetFilename, 'matches' );
        } );
    } );
    describe( 'original', function() {
        it( 'should return original image filename', function() {
            var sourceFilename = '8b58d54b86c4ccd44a0e4172e240a047-o07800500-w280-h1aa.jpg';
            var targetFilename = '8b58d54b86c4ccd44a0e4172e240a047-o07800500.jpg';
            assert.equal( imageFilename.original( sourceFilename ), targetFilename, 'matches' );
        } );
    } );
    describe( 'thumbnail', function() {
        it( 'should return image thumbnail filename', function() {
            var sourceFilename = '8b58d54b86c4ccd44a0e4172e240a047-o0640042b-w280-h1aa.jpg';
            var targetFilename = '8b58d54b86c4ccd44a0e4172e240a047-o0640042b-w0c8-h085.jpg';
            assert.equal( imageFilename.thumbnail( sourceFilename, 200 ), targetFilename, 'matches' );
        } );
    } );
    describe( 'url parser', function() {
        it( 'should return image thumbnail filename', function() {
            var url = 'http://localhost:4567/static/b8172eb9/8b58d54b86c4ccd44a0e4172e240a047-o07800500-w280-h1aa/img_123.jpg';
            var targetFilename = '8b58d54b86c4ccd44a0e4172e240a047-o07800500-w280-h1aa.jpg';
            var urlParser = imageFilename.urlParser( url );
            assert.deepEqual( urlParser, {
                baseUrl: 'http://localhost:4567/static/',
                encodedFilename: '8b58d54b86c4ccd44a0e4172e240a047-o07800500-w280-h1aa',
                originalFilename: 'img_123',
                ext: '.jpg'
            }, 'matches' );
        } );
    } );
} );