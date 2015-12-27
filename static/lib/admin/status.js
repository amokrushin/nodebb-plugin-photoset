'use strict';

/* globals define, require, $, app, socket, config, ajaxify, RELATIVE_PATH, utils */

(function() {
    define( 'photoset/admin/status', ['moment'], function( moment ) {
        var blockTemplates = $.Deferred( function( dfd ) {
            ajaxify.loadTemplate( 'admin/plugins/photoset', function( tpl ) {
                dfd.resolve( {
                    status: templates.getBlock( tpl, 'status' ),
                    workers: templates.getBlock( tpl, 'workers' )
                } );
            } );
        } ).promise();

        function getStatus( module ) {
            return $.Deferred( function( dfd ) {
                socket.emit( 'plugins.photoset.status', module, function( err, status ) {
                    dfd.resolve( status );
                } );
            } ).promise();
        }

        function statusFormatting( $container ) {
            $container.find( '.timestamp' ).each( function() {
                var $timestamp = $( this );
                $timestamp.text( moment( parseInt( $timestamp.text() ) ).fromNow() );
            } );
            $container.find( '.worker__status' ).each( function() {
                var $cell = $( this );
                switch( $cell.text() )
                {
                    case 'active':
                        $cell.addClass( 'text-success' );
                        break;
                    case 'updating':
                        $cell.addClass( 'text-warning' );
                        $cell.html( '<i class="fa fa-refresh fa-spin"></i>' );
                        break;
                    case 'inactive':
                    case 'fail':
                        $cell.addClass( 'text-danger' );
                        break;
                    default:
                }
            } );
        }

        function updateStatusBlock( status ) {
            blockTemplates.then( function( tpls ) {
                // It seems like template's loop and block have the same syntax.
                // So templates.parse( ... , status ) does not work.
                var $html = $( templates.parse( tpls.status, {status: [status]} ) );
                statusFormatting( $html );
                $( '.status-wrapper' ).replaceWith( $html );
            } )
        }

        $( window ).on( 'photoset.updateStatus', function( e, module ) {
            getStatus( module ).then( updateStatusBlock );
        } );

        function updateStatus() {
            getStatus().then( function( status ) {
                updateStatusBlock( status );
                setTimeout( updateIpwStatus, 60000 );
            } );
        }

        function updateIpwStatus() {
            getStatus( 'ipw' ).then( function( status ) {
                updateStatusBlock( status );
                if( status.ipw.updateInProgress )
                {
                    setTimeout( updateIpwStatus, 2000 );
                }
            } );
        }

        $( function() {
            updateIpwStatus();
            setTimeout( updateStatus, 60000 );
        } );

        return {
            statusFormatting: statusFormatting
        }
    } );
}());