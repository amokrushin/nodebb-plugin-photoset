'use strict';

/* globals define, require, $, app, socket, config, ajaxify, RELATIVE_PATH, utils */

(function() {
    define( 'photoswipe-loader', ['photoswipe', 'photoswipe-ui-default', 'image-filename'], function( PhotoSwipe, PhotoSwipeUI, imageFilename ) {
        var photoswipe = {},
            photosets = [];

        photoswipe.post = function( $post ) {
            var postId = $post.attr( 'data-pid' ),
                $photoswipeContainers = $post.find( '.photoset-grid' );

            $post.find( '.photoset-grid' ).removeClass( 'hidden' ).justifiedGallery( {
                rowHeight: 160,
                fixedHeight: true,
                lastRow: 'justify',
                margins: 4,
                waitThumbnailsLoad: true,
                captions: true,
                captionSettings: {
                    animationDuration: 500,
                    visibleOpacity: 0.7,
                    nonVisibleOpacity: 0.0
                }
            } );

            $photoswipeContainers.each( function( index ) {
                photoswipe.initPhotoswipe( $( this ), 'ps-' + postId + '-' + index );
            } );
        };

        photoswipe.preview = function( $preview ) {
            var $images = $preview.find( 'img.img-markdown:not(a)' );
            $images.each( function() {
                var $image = $( this );
                if( $image.hasClass( 'img-photoset' ) ) return;
                var $container = $( '<div class="photoset-grid hidden"></div>' ).insertBefore( $image ),
                    $photoset = $image.nextUntil( ':not(img)' ).add( $image );

                $photoset.each( function() {
                    var $image = $( this ),
                        urlParser = imageFilename.urlParser( $image.attr( 'src' ) ),
                        encodedFilename,
                        imageinfo;
                    if( !urlParser ) return;
                    encodedFilename = urlParser.encodedFilename + urlParser.ext;
                    imageinfo = imageFilename.decode( encodedFilename );
                    if( !imageinfo ) return;

                    $image.addClass( 'img-photoset not-responsive' );
                    $image.removeClass( 'img-responsive' );
                    $image.attr( 'width', imageinfo.width );
                    $image.attr( 'height', imageinfo.height );
                    $image.appendTo( $container );
                    if( !$image.parent().is( 'a' ) )
                    {
                        $image.wrap( '<a href="' + $image.attr( 'src' ) + '" target="_blank">' );
                    }
                } );

                $container.justifiedGallery( {
                    rowHeight: 160,
                    fixedHeight: true,
                    lastRow: 'justify',
                    margins: 4,
                    waitThumbnailsLoad: true,
                    captions: true,
                    captionSettings: {
                        animationDuration: 500,
                        visibleOpacity: 0.7,
                        nonVisibleOpacity: 0.0
                    }
                } ).removeClass( 'hidden' );
            } );
        };

        photoswipe.initPhotoswipe = function( $photoswipeContainer, photosetId ) {
            var $images = $photoswipeContainer.find( '.img-photoset' );

            photosets[photosetId] = [];

            $images.each( function( index ) {
                var $image = $( this ),
                    urlParser = imageFilename.urlParser( $image.attr( 'data-hires' ) );
                if( !urlParser ) return;
                var fileinfo = imageFilename.decode( urlParser.encodedFilename + urlParser.ext );
                photosets[photosetId].push( {
                    photosetId: photosetId,
                    index: index,
                    src: $image.attr( 'data-hires' ),
                    w: fileinfo.width,
                    h: fileinfo.height,
                    $el: $image,
                    msrc: $image.attr( 'src' )
                } );
                $image.parent( 'a' ).off( 'click' ).on( 'click', {
                    $el: $image,
                    index: index,
                    photosetId: photosetId
                }, photoswipe.galleryImageClick );
            } );
        };

        photoswipe.enable = function() {
            for( var photoset in photosets )
            {
                if( photosets.hasOwnProperty( photoset ) )
                {
                    photosets[photoset].forEach( function( item ) {
                        item.$el.on( 'click', {
                            $el: item.$el,
                            index: item.index,
                            photosetId: item.photosetId
                        }, photoswipe.galleryImageClick );
                    } );
                }
            }
        };

        photoswipe.galleryImageClick = function( event ) {
            event.preventDefault();
            photoswipe.openPhotoSwipe( event.data.index, event.data.photosetId )
        };

        photoswipe.openPhotoSwipe = function( index, photosetId, disableAnimation, fromURL ) {
            var pswpElement = document.querySelectorAll( '.pswp' )[0],
                pswp,
                options,
                items;

            items = photosets[photosetId];
            if( !items ) return;

            options = {
                galleryUID: photosetId,
                getThumbBoundsFn: function( index ) {
                    var $thumbnail = items[index].$el;
                    return {
                        x: $thumbnail.offset().left,
                        y: $thumbnail.offset().top,
                        w: $thumbnail.width()
                    };
                },
                index: parseInt( index, 10 ),
                history: false,
                showHideOpacity: true
            };
            if( fromURL ) options.index--;

            if( isNaN( options.index ) ) return;

            if( disableAnimation ) options.showAnimationDuration = 0;
            pswp = new PhotoSwipe( pswpElement, PhotoSwipeUI, items, options );
            pswp.init();
        };

        return photoswipe;
    } );
}());