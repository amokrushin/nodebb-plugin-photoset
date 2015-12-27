<div class="modal fade" id="photoset-settings__modal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                            aria-hidden="true">&times;</span></button>
                <h4 class="modal-title">Photoset
                    <small>settings</small>
                </h4>
            </div>
            <div class="modal-body">
                <form id="photoset-settings__form">
                    <div class="form-group">
                        <label for="hmac-key" class="control-label">HMAC key:</label>
                        <input type="text" class="form-control" id="hmac-key"
                               data-key="photoset.hmac.key"/>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
                <button type="button" class="btn btn-primary" id="photoset-settings__save">Save changes</button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
    'use strict';
    /* globals define, $, socket, ajaxify, app */

    require( ['settings'], function( settings ) {
        var $form = $( '#photoset-settings__form' );
        var $modal = $( '#photoset-settings__modal' );

        settings.sync( 'photoset', $form );
        $modal.on( 'show.bs.modal', function(  ) {
            settings.sync( 'photoset', $form );
        } );

        $( '#photoset-settings__save' ).on( 'click', function( event ) {
            event.preventDefault();
            settings.persist( 'photoset', $form, function() {
                socket.emit( 'plugins.photoset.syncSettings' );
            } );
            $modal.modal( 'hide' );
        } );
    } );
</script>