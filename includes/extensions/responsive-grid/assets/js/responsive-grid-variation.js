( function ( wp ) {
	const { registerBlockVariation } = wp.blocks;
	const { __ } = wp.i18n;

	registerBlockVariation( 'core/group', {
		name: 'responsive-grid',
		title: __( 'Responsive grid', 'monk-extensions' ),
		description: __( 'A grid that wraps responsively using a minimum column width.', 'monk-extensions' ),
		attributes: {
			layout: {
				type: 'grid',
				minimumColumnWidth: '12rem',
			},
		},
		scope: [ 'inserter' ],
	} );
} )( window.wp );
