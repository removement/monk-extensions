<?php
/**
 * Paragraph link relations extension.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions\Extensions\Paragraph_Link_Relations;

use MonkExtensions\Extension_Interface;

defined( 'ABSPATH' ) || exit;

/**
 * Adds "Additional link relations" to the paragraph link popup.
 */
final class Paragraph_Link_Relations_Extension implements Extension_Interface {

	/**
	 * @return string
	 */
	public function get_id() {
		return 'paragraph_link_relations';
	}

	/**
	 * @return string
	 */
	public function get_label() {
		return __( 'Paragraph link relations', 'monk-extensions' );
	}

	/**
	 * @return string
	 */
	public function get_description() {
		return __( 'Adds "Additional link relations" to the link popup in Paragraph blocks.', 'monk-extensions' );
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
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_assets' ) );
	}

	/**
	 * @return void
	 */
	public function enqueue_editor_assets() {
		$script_path = __DIR__ . '/assets/js/link-additional-rel.js';

		wp_enqueue_script(
			'monk-extensions-paragraph-link-relations',
			$this->asset_url( 'js/link-additional-rel.js' ),
			array(
				'wp-a11y',
				'wp-block-editor',
				'wp-components',
				'wp-compose',
				'wp-data',
				'wp-element',
				'wp-i18n',
				'wp-primitives',
				'wp-rich-text',
				'wp-url',
			),
			(string) filemtime( $script_path ),
			true
		);
	}

	/**
	 * @param string $path Relative path inside the extension assets directory.
	 * @return string
	 */
	private function asset_url( $path ) {
		return plugins_url( 'assets/' . ltrim( $path, '/' ), __FILE__ );
	}
}
