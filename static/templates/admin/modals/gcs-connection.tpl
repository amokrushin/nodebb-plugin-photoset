<div class="modal fade" id="gcs-connection__modal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                            aria-hidden="true">&times;</span></button>
                <h4 class="modal-title">Google Cloud Storage
                    <small>connection settings</small>
                </h4>
            </div>
            <div class="modal-body">
                <ol>
                    <li><a href="https://cloud.google.com/storage/docs/getting-started-console" target="_blank">Getting
                            Started with Google Cloud Storage</a></li>
                    <li><a href="https://cloud.google.com/storage/docs/overview" target="_blank">Generating a service
                            account credential</a></li>
                </ol>
                <form id="gcs-connection__form">
                    <div class="form-group">
                        <label for="gcs-projectid" class="control-label">Project ID:</label>
                        <input type="text" class="form-control" id="gcs-projectid"
                               data-key="gcs.projectId"/>
                    </div>
                    <div class="form-group">
                        <input type="text" class="form-control" id="gcs-jsonkey" placeholder="Paste JSON key here"/>
                    </div>
                    <div class="form-group">
                        <label for="gcs-clientemail" class="control-label">Client email:</label>
                        <input type="text" class="form-control" id="gcs-clientemail"
                               data-key="gcs.credentials.clientEmail"/>
                    </div>
                    <div class="form-group">
                        <label for="gcs-privatekey" class="control-label">Private key:</label>
                        <textarea class="form-control" id="gcs-privatekey" data-key="gcs.credentials.privateKey"/>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="gcs-connection__save">Save changes</button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
    'use strict';
    /* globals define, $, socket, ajaxify, app */

    require( ['settings'], function( settings ) {
        var $form = $( '#gcs-connection__form' );
        var $modal = $( '#gcs-connection__modal' );

        settings.sync( 'photoset', $form );
        $modal.on( 'show.bs.modal', function() {
            settings.sync( 'photoset', $form );
        } );

        $( '#gcs-connection__save' ).on( 'click', function( event ) {
            event.preventDefault();
            settings.persist( 'photoset', $form, function() {
                socket.emit( 'plugins.photoset.syncSettings', function() {
                    $( window ).trigger( 'photoset.updateStatus', 'gcs' );
                } );
            } );
            $modal.modal( 'hide' );
        } );

        $( '#gcs-jsonkey' ).on( 'paste', function( e ) {
            var clipboardData = e.clipboardData || e.originalEvent.clipboardData || window.clipboardData;
            var pastedData = clipboardData.getData( 'text' );
            var jsonKey;

            try
            {
                jsonKey = JSON.parse( pastedData );
            } catch( err )
            {
                return app.alertError( 'Pasted data is not valid Google JSON key' );
            }
            if( !jsonKey.client_email || !jsonKey.private_key )
            {
                return app.alertError( 'Pasted data is not valid Google JSON key' );
            }

            $( '#gcs-clientemail' ).val( jsonKey.client_email );
            $( '#gcs-privatekey' ).val( jsonKey.private_key );

            setTimeout( function() {
                $( '#gcs-jsonkey' ).val( '' );
            }, 500 );
        } );
    } );
</script>