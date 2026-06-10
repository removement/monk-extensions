( function ( wp ) {
	const { createElement, useEffect, useState, useCallback } = wp.element;
	const { Spinner, SnackbarList, FormToggle } = wp.components;
	const { useSelect, useDispatch } = wp.data;
	const { __, sprintf } = wp.i18n;
	const apiFetch = wp.apiFetch;

	function useSnackbarNotices() {
		const notices = useSelect(
			function ( select ) {
				return select( 'core/notices' )
					.getNotices()
					.filter( function ( notice ) {
						return notice.type === 'snackbar';
					} );
			},
			[]
		);

		const { removeNotice } = useDispatch( 'core/notices' );

		return { notices, removeNotice };
	}

	function SettingsItem( { item, checked, disabled, onChange } ) {
		const toggleId = 'monk-extension-toggle-' + item.id;
		const descriptionId = 'monk-extension-desc-' + item.id;

		return createElement(
			'div',
			{ className: 'monk-extensions-card__item', key: item.id },
			createElement(
				'div',
				{ className: 'monk-extensions-card__item-toggle' },
				createElement( FormToggle, {
					id: toggleId,
					checked: checked,
					disabled: disabled,
					onChange: function ( event ) {
						onChange( event.target.checked );
					},
					'aria-describedby': descriptionId,
				} )
			),
			createElement(
				'div',
				{ className: 'monk-extensions-card__item-content' },
				createElement(
					'label',
					{
						className: 'monk-extensions-card__item-label',
						htmlFor: toggleId,
					},
					item.label
				),
				createElement(
					'p',
					{
						className: 'monk-extensions-card__item-description',
						id: descriptionId,
					},
					item.description
				)
			)
		);
	}

	function ExtensionCard( { group, settings, savingId, onToggle } ) {
		return createElement(
			'details',
			{
				className: 'monk-extensions-card',
				open: true,
				key: group.slug,
			},
			createElement( 'summary', { className: 'monk-extensions-card__header' }, group.label ),
			createElement(
				'div',
				{ className: 'monk-extensions-card__body' },
				group.items.map( function ( item ) {
					return createElement( SettingsItem, {
						key: item.id,
						item: item,
						checked: !! settings[ item.id ],
						disabled: savingId === item.id,
						onChange: function ( value ) {
							onToggle( item.id, value, group.label );
						},
					} );
				} )
			)
		);
	}

	function App() {
		const [ groups, setGroups ] = useState( [] );
		const [ settings, setSettings ] = useState( null );
		const [ isLoading, setIsLoading ] = useState( true );
		const [ savingId, setSavingId ] = useState( null );
		const { notices, removeNotice } = useSnackbarNotices();
		const { createSuccessNotice, createErrorNotice } = useDispatch( 'core/notices' );

		useEffect( function () {
			Promise.all( [
				apiFetch( { path: '/monk-extensions/v1/extensions' } ),
				apiFetch( { path: '/monk-extensions/v1/settings' } ),
			] )
				.then( function ( results ) {
					setGroups( results[ 0 ] || [] );
					setSettings( results[ 1 ] || {} );
				} )
				.catch( function () {
					createErrorNotice(
						__( 'Could not load extension settings.', 'monk-extensions' ),
						{ type: 'snackbar' }
					);
				} )
				.finally( function () {
					setIsLoading( false );
				} );
		}, [ createErrorNotice ] );

		const handleToggle = useCallback(
			function ( id, enabled, groupLabel ) {
				if ( ! settings ) {
					return;
				}

				const previous = settings;
				const next = Object.assign( {}, settings, { [ id ]: enabled } );

				setSettings( next );
				setSavingId( id );

				apiFetch( {
					path: '/monk-extensions/v1/settings',
					method: 'POST',
					data: next,
				} )
					.then( function ( response ) {
						setSettings( response );
						createSuccessNotice(
							sprintf(
								/* translators: %s: Extension group name, e.g. "Blocks". */
								__( '%s settings updated.', 'monk-extensions' ),
								groupLabel
							),
							{ type: 'snackbar' }
						);
					} )
					.catch( function () {
						setSettings( previous );
						createErrorNotice(
							sprintf(
								/* translators: %s: Extension group name, e.g. "Blocks". */
								__( 'Failed to update %s settings.', 'monk-extensions' ),
								groupLabel
							),
							{ type: 'snackbar' }
						);
					} )
					.finally( function () {
						setSavingId( null );
					} );
			},
			[ settings, createSuccessNotice, createErrorNotice ]
		);

		if ( isLoading || ! settings ) {
			return createElement(
				'div',
				{ className: 'monk-extensions-page monk-extensions-page__loading' },
				createElement( Spinner, null )
			);
		}

		return createElement(
			'div',
			{ className: 'monk-extensions-page' },
			createElement(
				'header',
				{ className: 'monk-extensions-page__header' },
				createElement(
					'h1',
					{ className: 'monk-extensions-page__header-title' },
					__( 'Monk Extensions', 'monk-extensions' )
				),
				createElement(
					'p',
					{ className: 'monk-extensions-page__header-subtitle' },
					__(
						'Optional block editor extensions for Monk themes. Enable the features you need — disabled extensions are not loaded on the front end or in the editor.',
						'monk-extensions'
					)
				)
			),
			createElement(
				'div',
				{ className: 'monk-extensions-page__form' },
				groups.map( function ( group ) {
					return createElement( ExtensionCard, {
						key: group.slug,
						group: group,
						settings: settings,
						savingId: savingId,
						onToggle: handleToggle,
					} );
				} )
			),
			createElement(
				'div',
				{ className: 'monk-extensions-page__snackbars' },
				createElement( SnackbarList, {
					notices: notices,
					onRemove: removeNotice,
				} )
			)
		);
	}

	function mount() {
		const root = document.getElementById( 'monk-extensions-settings-app' );
		if ( ! root ) {
			return;
		}

		if ( wp.element.createRoot ) {
			wp.element.createRoot( root ).render( createElement( App ) );
			return;
		}

		wp.element.render( createElement( App ), root );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', mount );
	} else {
		mount();
	}
} )( window.wp );
