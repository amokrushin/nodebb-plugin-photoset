<!-- Modal -->
<div class="modal fade" id="ipw-apikey__modal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span
                            aria-hidden="true">&times;</span></button>
                <h4 class="modal-title">Image resize workers
                    <small>API keys</small>
                </h4>
            </div>
            <div class="modal-body">
                <form id="ipw-apikey__form">
                    <ul class="list ipw-apikey__list list-unstyled">
                        <li class="list-item ipw-apikey__item ipw-apikey__item--template hidden">
                            <div class="input-group">
                                <input class="form-control ipw-apikey__input" type="text" value="Readonly input here"
                                       readonly>
                                  <span class="input-group-btn">
                                    <button class="btn btn-warning ipw-apikey__remove" type="button">
                                        <i class="fa fa-fw fa-trash-o"></i>
                                    </button>
                                  </span>
                            </div>
                        </li>
                        <li class="list-item">
                            <button type="button" class="btn btn-primary ipw-apikey__add pull-right">New API key
                            </button>
                        </li>
                    </ul>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

<script type="text/javascript">
    'use strict';
    /* globals define, $, socket, ajaxify, app */
    require( ['settings'], function( settings ) {
        var $modal = $( '#ipw-apikey__modal' );
        var $form = $( '#ipw-apikey__form' );
        var $template = $form.find( '.ipw-apikey__item--template' );
        $form.find( '.ipw-apikey__add' ).on( 'click', add );

        function $appendApiKey( apiKey ) {
            var $apiKey = $template.clone().removeClass( 'hidden ipw-apikey__item--template' );
            $apiKey.find( '.ipw-apikey__input' ).val( apiKey );
            $apiKey.insertBefore( $template );
            $apiKey.find( '.ipw-apikey__remove' ).on( 'click', remove );
            $apiKey.find( '.ipw-apikey__input' ).on( 'click', selectApiKey ).css( 'cursor', 'pointer' );
        }

        $modal.on( 'show.bs.modal', function( e ) {
            settings.sync( 'photoset', $form, function() {
                var apiKeys = settings.get().irw.apiKeys;
                apiKeys.forEach( $appendApiKey );
            } );
        } );

        $modal.on( 'hide.bs.modal', function( e ) {
            $form.find( '.ipw-apikey__item:not(.ipw-apikey__item--template)' ).remove();
        } );

        function add() {
            socket.emit( 'plugins.photoset.apiKeyNew', function( err, apiKey ) {
                if( err ) return app.alertError( err.message );
                $appendApiKey( apiKey );
            } );
        }

        function remove() {
            var $apiKeyItem = $( this ).closest( '.ipw-apikey__item' );
            socket.emit( 'plugins.photoset.apiKeyRemove',
                    $apiKeyItem.find( '.ipw-apikey__input' ).val(),
                    function( err ) {
                        if( err ) return app.alertError( err.message );
                        $apiKeyItem.remove();
                    }
            );
        }

        function selectApiKey() {
            $( this ).focus().select();
        }

    } );
</script>