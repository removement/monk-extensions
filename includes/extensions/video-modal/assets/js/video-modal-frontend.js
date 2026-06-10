( function () {
	const triggers = document.querySelectorAll( '[data-monk-video-modal="1"]' );
	const container = document.querySelector( '[data-monk-video-modal-container]' );

	if ( ! triggers.length || ! container ) {
		return;
	}

	const content = container.querySelector( '[data-monk-video-modal-content]' );
	const closeButtons = container.querySelectorAll( '[data-monk-video-modal-close]' );
	let previousOverflow = '';

	function getYoutubeEmbedUrl( urlOrId, autoplay, startTime ) {
		if ( ! urlOrId ) {
			return '';
		}

		const start = Number.isFinite( startTime ) && startTime > 0 ? '&start=' + startTime : '';
		const autoplayQuery = ( autoplay ? 'autoplay=1&rel=0' : 'autoplay=0&rel=0' ) + start;

		if ( /^[A-Za-z0-9_-]{6,}$/.test( urlOrId ) ) {
			return 'https://www.youtube.com/embed/' + urlOrId + '?' + autoplayQuery;
		}

		try {
			const parsed = new URL( urlOrId );
			if ( parsed.hostname.includes( 'youtu.be' ) ) {
				const id = parsed.pathname.replace( '/', '' );
				return id ? 'https://www.youtube.com/embed/' + id + '?' + autoplayQuery : '';
			}

			if ( parsed.hostname.includes( 'youtube.com' ) ) {
				const id = parsed.searchParams.get( 'v' );
				if ( id ) {
					return 'https://www.youtube.com/embed/' + id + '?' + autoplayQuery;
				}

				if ( parsed.pathname.includes( '/shorts/' ) ) {
					const shortId = parsed.pathname.split( '/shorts/' )[1]?.split( '/' )[0];
					return shortId ? 'https://www.youtube.com/embed/' + shortId + '?' + autoplayQuery : '';
				}
			}
		} catch ( e ) {
			return '';
		}

		return '';
	}

	function closeModal() {
		container.setAttribute( 'hidden', '' );
		container.classList.remove( 'is-open' );
		document.documentElement.classList.remove( 'monk-video-modal-open' );
		document.body.style.overflow = previousOverflow;
		content.innerHTML = '';
	}

	function openModal( options ) {
		const type = options.type;
		const url = options.url;
		const youtubeId = options.youtubeId;
		const autoplay = options.autoplay;
		const startTime = options.startTime;

		if ( ! url && ! youtubeId ) {
			return;
		}

		let html = '';

		if ( 'youtube' === type ) {
			const embedUrl = getYoutubeEmbedUrl( youtubeId || url, autoplay, startTime );
			if ( ! embedUrl ) {
				return;
			}

			html =
				'<div class="monk-video-modal__aspect-ratio">' +
				'<iframe src="' +
				embedUrl +
				'" title="Video" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>' +
				'</div>';
		} else {
			html =
				'<video controls ' +
				( autoplay ? 'autoplay ' : '' ) +
				'playsinline>' +
				'<source src="' +
				url +
				'" type="video/mp4">' +
				'</video>';
		}

		content.innerHTML = html;
		container.removeAttribute( 'hidden' );
		container.classList.add( 'is-open' );

		previousOverflow = document.body.style.overflow;
		document.documentElement.classList.add( 'monk-video-modal-open' );
		document.body.style.overflow = 'hidden';
	}

	triggers.forEach( function ( trigger ) {
		trigger.addEventListener( 'click', function ( event ) {
			event.preventDefault();
			event.stopPropagation();

			const type = trigger.getAttribute( 'data-monk-video-modal-type' ) || 'youtube';
			const url = trigger.getAttribute( 'data-monk-video-modal-url' ) || '';
			const videoSource = trigger.getAttribute( 'data-video-source' ) || type;
			const youtubeId = trigger.getAttribute( 'data-youtube-id' ) || '';
			const autoplay = 'false' !== trigger.getAttribute( 'data-video-autoplay' );
			const rawStart = parseInt( trigger.getAttribute( 'data-video-start' ) || '0', 10 );
			const startTime = Number.isFinite( rawStart ) && rawStart > 0 ? rawStart : 0;

			openModal( {
				type: 'youtube' === videoSource ? 'youtube' : 'upload',
				url,
				youtubeId,
				autoplay,
				startTime,
			} );
		} );
	} );

	closeButtons.forEach( function (button) {
		button.addEventListener( 'click', closeModal );
	} );

	document.addEventListener( 'keydown', function (event) {
		if ( 'Escape' === event.key && container.classList.contains( 'is-open' ) ) {
			closeModal();
		}
	} );
} )();
