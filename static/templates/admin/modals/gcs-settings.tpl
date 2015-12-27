<div class="modal fade" id="gcs-settings__modal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                            aria-hidden="true">&times;</span></button>
                <h4 class="modal-title">Google Cloud Storage
                    <small>settings</small>
                </h4>
            </div>
            <div class="modal-body">
                <form id="gcs-settings__form">
                    <label for="bucket">Bucket</label>
                    <select class="form-control gcs-settings__buckets-list" name="bucket"> </select>
                    <input type="text" class="hidden gcs-settings__bucket" data-key="gcs.bucket"/>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="gcs-settings__save">Save changes</button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
    'use strict';
    /* globals define, $, socket, ajaxify, app */

    require( ['settings'], function( settings ) {
        var $modal = $( '#gcs-settings__modal' );
        var $form = $( '#gcs-settings__form' );
        var $bucketsList = $( '.gcs-settings__buckets-list' );

        settings.sync( 'photoset', $form );
        $modal.on( 'show.bs.modal', function( e ) {
            settings.sync( 'photoset', $form );
            socket.emit( 'plugins.photoset.gcsBuckets', function( err, buckets ) {
                if( err ) return app.alertError( err.message );
                buckets.forEach( function( bucket ) {
                    $bucketsList.append( $( '<option>' ).attr( 'value', bucket ).text( bucket ) );
                } );
                $bucketsList.val( $( '.gcs-settings__bucket' ).val() );
            } );
        } );
        $modal.on( 'hide.bs.modal', function( e ) {
            $bucketsList.html( '' );
        } );

        $( '#gcs-settings__save' ).on( 'click', function( event ) {
            $( '.gcs-settings__bucket' ).val( $bucketsList.val() );
            event.preventDefault();
            settings.persist( 'photoset', $form, function() {
                socket.emit( 'plugins.photoset.syncSettings', function() {
                    $( window ).trigger( 'photoset.updateStatus', 'gcs' );
                } );
            } );
            $modal.modal( 'hide' );
        } );
    } );
</script>