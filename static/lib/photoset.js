'use strict';

/* globals define, require, $, app, socket, config, ajaxify, RELATIVE_PATH, utils */

(function() {
    require( ['photoswipe-loader', 'forum/topic/posts'], function( photoswipe, Posts ) {
        /* Disable default wrapping the images in links */
        //Posts.wrapImagesInLinks = function() {};

        $( window )
            .on( 'action:topic.loaded', function() {
                $( '[component="post"]' ).each( function() {
                    photoswipe.post( $( this ) );
                } );

            } )
            .on( 'action:posts.loaded', function( e, data ) {
                data.posts.forEach( function( post ) {
                    photoswipe.post( $( '[component="post"][data-pid="' + post.pid + '"]' ) );
                } );
            } )
            .on( 'action:posts.edited', function( e, data ) {
                setTimeout( function() {
                    photoswipe.post( $( '[component="post"][data-pid="' + data.post.pid + '"]' ) );
                }, 2000 );
            } );
    } );
    $( document ).ready( function() {
        $( window ).on( 'action:app.load', function() {
            console.log( 'nodebb-plugin-photoset: loaded' );


            //$(window).on('action:composer.topic.new', function(ev, data) {
            //    composer.newTopic({
            //        cid: data.cid,
            //        title: data.title,
            //        body: data.body
            //    });
            //});

            //$(window).on('action:composer.post.edit', function(ev, data) {
            //    composer.editPost(data.pid);
            //});

            //$(window).on('action:composer.post.new', function(ev, data) {
            //    composer.newReply(data.tid, data.pid, data.topicName, data.text);
            //});

            //$(window).on('action:composer.addQuote', function(ev, data) {
            //    redactor.addQuote(data.tid, data.slug, data.index, data.pid, data.topicName, data.username, data.text);
            //});
            //} );
        } );
    } );
}());