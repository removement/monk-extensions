<?php
/**
 * Responsive grid breakpoints block extension.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions\Extensions\Responsive_Grid;

use MonkExtensions\Extension_Interface;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/render.php';

/**
 * Responsive grid extension for core/group grid layouts.
 */
final class Responsive_Grid_Extension implements Extension_Interface {

	/**
	 * @return string
	 */
	public function get_id() {
		return 'responsive_grid';
	}

	/**
	 * @return string
	 */
	public function get_label() {
		return __( 'Responsive grid breakpoints', 'monk-extensions' );
	}

	/**
	 * @return string
	 */
	public function get_description() {
		return __( 'Adds parent column/row breakpoints and per-child grid span overrides for core/group grid layouts.', 'monk-extensions' );
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
		Grid_Breakpoints::register_hooks();
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_assets' ) );
	}

	/**
	 * @return void
	 */
	public function enqueue_editor_assets() {
		$variation_path = __DIR__ . '/assets/js/responsive-grid-variation.js';
		$editor_path    = __DIR__ . '/assets/js/grid-breakpoints-editor.js';

		if ( file_exists( $variation_path ) ) {
			wp_enqueue_script(
				'monk-extensions-responsive-grid-variation',
				$this->asset_url( 'js/responsive-grid-variation.js' ),
				array( 'wp-blocks', 'wp-i18n' ),
				(string) filemtime( $variation_path ),
				true
			);
		}

		if ( ! file_exists( $editor_path ) ) {
			return;
		}

		wp_enqueue_script(
			'monk-extensions-grid-breakpoints-editor',
			$this->asset_url( 'js/grid-breakpoints-editor.js' ),
			array(
				'wp-block-editor',
				'wp-blocks',
				'wp-components',
				'wp-compose',
				'wp-data',
				'wp-element',
				'wp-hooks',
				'wp-i18n',
				'wp-dom-ready',
			),
			(string) filemtime( $editor_path ),
			true
		);

		wp_set_script_translations(
			'monk-extensions-grid-breakpoints-editor',
			'monk-extensions',
			MONK_EXTENSIONS_DIR . 'languages'
		);
	}

	/**
	 * @param string $path Relative path inside extension assets.
	 * @return string
	 */
	private function asset_url( $path ) {
		return plugins_url( 'assets/' . ltrim( $path, '/' ), __FILE__ );
	}
}
