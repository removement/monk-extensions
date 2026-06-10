<?php
/**
 * Video modal block extension.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions\Extensions\Video_Modal;

use MonkExtensions\Extension_Interface;

defined( 'ABSPATH' ) || exit;

/**
 * Video modal extension for core/cover and core/button blocks.
 */
final class Video_Modal_Extension implements Extension_Interface {

	/**
	 * @return string
	 */
	public function get_id() {
		return 'video_modal';
	}

	/**
	 * @return string
	 */
	public function get_label() {
		return __( 'Video modal', 'monk-extensions' );
	}

	/**
	 * @return string
	 */
	public function get_description() {
		return __( 'Opens YouTube or uploaded video in a modal with backdrop blur and scroll lock on Cover and Button blocks.', 'monk-extensions' );
	}

	/**
	 * @return array{slug: string, label: string}
	 */
	public function get_group() {
		return array(
			'slug'  => 'blocks',
			'label' => _x( 'Blocks', 'extensions group name', 'monk-extensions' ),
		);
	}

	/**
	 * @return void
	 */
	public function register() {
		add_action( 'init', array( $this, 'register_block_style' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_assets' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_assets' ) );
		add_action( 'wp_footer', array( $this, 'render_modal_container' ) );
		add_filter( 'render_block', array( $this, 'add_block_attributes' ), 10, 2 );
	}

	/**
	 * Register the optional button block style.
	 *
	 * @return void
	 */
	public function register_block_style() {
		register_block_style(
			'core/button',
			array(
				'name'  => 'video-modal',
				'label' => __( 'Video Modal', 'monk-extensions' ),
			)
		);

		$style_path = __DIR__ . '/assets/css/button-style.css';

		if ( ! file_exists( $style_path ) ) {
			return;
		}

		wp_register_style(
			'monk-extensions-video-modal-button-style',
			$this->asset_url( 'css/button-style.css' ),
			array( 'wp-block-library' ),
			(string) filemtime( $style_path )
		);

		wp_enqueue_block_style(
			'core/button',
			array(
				'handle' => 'monk-extensions-video-modal-button-style',
				'src'    => $this->asset_url( 'css/button-style.css' ),
				'path'   => $style_path,
			)
		);
	}

	/**
	 * @return void
	 */
	public function enqueue_editor_assets() {
		$style_path  = __DIR__ . '/assets/css/video-modal.css';
		$script_path = __DIR__ . '/assets/js/video-modal-editor.js';

		wp_enqueue_style(
			'monk-extensions-video-modal-editor',
			$this->asset_url( 'css/video-modal.css' ),
			array( 'wp-edit-blocks' ),
			(string) filemtime( $style_path )
		);

		wp_enqueue_script(
			'monk-extensions-video-modal-editor',
			$this->asset_url( 'js/video-modal-editor.js' ),
			array(
				'wp-block-editor',
				'wp-blocks',
				'wp-components',
				'wp-compose',
				'wp-element',
				'wp-hooks',
			),
			(string) filemtime( $script_path ),
			true
		);
	}

	/**
	 * @return void
	 */
	public function enqueue_frontend_assets() {
		$style_path  = __DIR__ . '/assets/css/video-modal.css';
		$script_path = __DIR__ . '/assets/js/video-modal-frontend.js';

		wp_enqueue_style(
			'monk-extensions-video-modal-frontend',
			$this->asset_url( 'css/video-modal.css' ),
			array(),
			(string) filemtime( $style_path )
		);

		wp_enqueue_script(
			'monk-extensions-video-modal-frontend',
			$this->asset_url( 'js/video-modal-frontend.js' ),
			array(),
			(string) filemtime( $script_path ),
			true
		);
	}

	/**
	 * @param string $block_content Block HTML.
	 * @param array  $block         Block data.
	 * @return string
	 */
	public function add_block_attributes( $block_content, $block ) {
		if ( empty( $block['blockName'] ) || ! in_array( $block['blockName'], array( 'core/cover', 'core/button' ), true ) ) {
			return $block_content;
		}

		$attrs = isset( $block['attrs'] ) ? $block['attrs'] : array();

		if ( empty( $attrs['monkVideoModalEnabled'] ) ) {
			return $block_content;
		}

		$video_type = isset( $attrs['monkVideoModalType'] ) ? sanitize_key( $attrs['monkVideoModalType'] ) : 'youtube';
		$youtube    = isset( $attrs['monkVideoModalYoutubeUrl'] ) ? esc_url_raw( $attrs['monkVideoModalYoutubeUrl'] ) : '';
		$uploaded   = isset( $attrs['monkVideoModalUploadedUrl'] ) ? esc_url_raw( $attrs['monkVideoModalUploadedUrl'] ) : '';
		$start_at   = isset( $attrs['monkVideoModalStart'] ) ? absint( $attrs['monkVideoModalStart'] ) : 0;
		$autoplay   = isset( $attrs['monkVideoModalAutoplay'] ) ? (bool) $attrs['monkVideoModalAutoplay'] : true;
		$play_icon  = isset( $attrs['monkVideoModalPlayIcon'] ) ? sanitize_key( $attrs['monkVideoModalPlayIcon'] ) : 'show';

		$video_url = 'youtube' === $video_type ? $youtube : $uploaded;
		if ( empty( $video_url ) ) {
			return $block_content;
		}

		$p = new \WP_HTML_Tag_Processor( $block_content );
		if ( ! $p->next_tag() ) {
			return $block_content;
		}

		$p->add_class( 'has-monk-video-modal' );
		$p->add_class( 'monk-video-modal-trigger' );
		if ( 'core/cover' === $block['blockName'] ) {
			$p->add_class( 'monk-video-icon-' . $play_icon );
		}
		$p->set_attribute( 'data-monk-video-modal', '1' );
		$p->set_attribute( 'data-monk-video-modal-type', $video_type );
		$p->set_attribute( 'data-monk-video-modal-url', esc_url( $video_url ) );
		$p->set_attribute( 'data-video-autoplay', $autoplay ? 'true' : 'false' );
		$p->set_attribute( 'data-video-source', 'youtube' === $video_type ? 'youtube' : 'upload' );
		$p->set_attribute( 'aria-label', __( 'Play video', 'monk-extensions' ) );

		if ( 'youtube' === $video_type ) {
			$youtube_id = $this->extract_youtube_video_id( $video_url );
			if ( ! empty( $youtube_id ) ) {
				$p->set_attribute( 'data-youtube-id', $youtube_id );
			}

			if ( $start_at > 0 ) {
				$p->set_attribute( 'data-video-start', (string) $start_at );
			}
		}

		return $p->get_updated_html();
	}

	/**
	 * @return void
	 */
	public function render_modal_container() {
		?>
		<div class="monk-video-modal" data-monk-video-modal-container hidden>
			<div class="monk-video-modal__backdrop" data-monk-video-modal-close></div>
			<div class="monk-video-modal__dialog" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e( 'Video modal', 'monk-extensions' ); ?>">
				<button type="button" class="monk-video-modal__close" data-monk-video-modal-close aria-label="<?php esc_attr_e( 'Close video', 'monk-extensions' ); ?>">
					&times;
				</button>
				<div class="monk-video-modal__content" data-monk-video-modal-content></div>
			</div>
		</div>
		<?php
	}

	/**
	 * @param string $path Relative path inside the extension assets directory.
	 * @return string
	 */
	private function asset_url( $path ) {
		return plugins_url( 'assets/' . ltrim( $path, '/' ), __FILE__ );
	}

	/**
	 * @param string $url YouTube URL.
	 * @return string
	 */
	private function extract_youtube_video_id( $url ) {
		$parts = wp_parse_url( $url );
		if ( empty( $parts['host'] ) ) {
			return '';
		}

		$host = strtolower( $parts['host'] );

		if ( false !== strpos( $host, 'youtu.be' ) && ! empty( $parts['path'] ) ) {
			return sanitize_text_field( ltrim( $parts['path'], '/' ) );
		}

		if ( false !== strpos( $host, 'youtube.com' ) ) {
			if ( ! empty( $parts['query'] ) ) {
				parse_str( $parts['query'], $query_vars );
				if ( ! empty( $query_vars['v'] ) ) {
					return sanitize_text_field( $query_vars['v'] );
				}
			}

			if ( ! empty( $parts['path'] ) && preg_match( '#^/shorts/([^/?]+)#', $parts['path'], $matches ) ) {
				return sanitize_text_field( $matches[1] );
			}
		}

		return '';
	}
}
