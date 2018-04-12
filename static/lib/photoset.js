'use strict';

/* globals define, require, $, app, socket, config, ajaxify, RELATIVE_PATH, utils */

(function () {
    require(['photoswipe-loader', 'forum/topic/posts'], function (photoswipe, Posts) {
        /* Disable default wrapping the images in links */
        Posts.wrapImagesInLinks = function () {};

        $(window)
            .on('action:topic.loaded', function () {
                $('[component="post"]').each(function () {
                    photoswipe.post($(this));
                });

            })
            .on('action:posts.loaded', function (e, data) {
                data.posts.forEach(function (post) {
                    photoswipe.post($('[component="post"][data-pid="' + post.pid + '"]'));
                });
            })
            .on('action:posts.edited', function (e, data) {
                photoswipe.post($('[component="post"][data-pid="' + data.post.pid + '"]'));
            })
            .on('action:composer.preview', function () {
                photoswipe.preview($('.composer-container .preview'));
            })
            .on('action:topic.loaded', function () {
                if ($('.pswp').length) return;
                templates.parse('photoswipe', {}, function (html) {
                    $('body').append(html);
                });
            });
    });
}());

