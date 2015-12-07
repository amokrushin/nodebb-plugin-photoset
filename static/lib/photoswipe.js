'use strict';

/* globals define, require, $, app, socket, config, ajaxify, RELATIVE_PATH, utils */

(function() {
    define( 'photoswipe-loader', ['photoswipe', 'photoswipe-ui-default', 'image-filename'], function( PhotoSwipe, PhotoSwipeUI, imageFilename ) {
        var photoswipe = {},
            photosets = [];

        photoswipe.post = function( $post ) {
            var postId = $post.attr( 'data-pid' );
            var $photoswipeContainers = $post.find( '.photoset-grid' );
            //$post.find( '.photoset-grid' ).removeClass( 'hidden' ).photosetGrid( {
            //    gutter: '5px'
            //} );
            $post.find( '.photoset-grid' ).removeClass( 'hidden' ).justifiedGallery( {
                //selector: '.img-photoset',
                rowHeight: 160,
                maxRowHeight: 300,
                //lastRow: 'center',
                margins: 4,
                waitThumbnailsLoad: false,
                //cssAnimation: true,
                //imagesAnimationDuration: 300,
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

        photoswipe.initPhotoswipe = function( $photoswipeContainer, photosetId ) {
            //$photoswipeContainer.addClass( 'photoswipe-active' );

            var $images = $photoswipeContainer.find( '.img-photoset' );

            photosets[photosetId] = [];

            var photoset = [];

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
                //$image.off( 'click' ).on( 'click', {
                //    $el: $image,
                //    index: index,
                //    photosetId: photosetId
                //}, photoswipe.galleryImageClick );
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