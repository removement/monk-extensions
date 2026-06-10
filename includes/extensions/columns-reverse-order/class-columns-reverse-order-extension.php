<?php
/**
 * Columns reverse order extension.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions\Extensions\Columns_Reverse_Order;

use MonkExtensions\Extension_Interface;

defined( 'ABSPATH' ) || exit;

/**
 * Adds a reverse-order toggle to the core Columns block.
 */
final class Columns_Reverse_Order_Extension implements Extension_Interface {

	private const STYLE_HANDLE = 'monk-extensions-columns-reverse-order';

	/**
	 * @return string
	 */
	public function get_id() {
		return 'columns_reverse_order';
	}

	/**
	 * @return string
	 */
	public function get_label() {
		return __( 'Columns reverse order', 'monk-extensions' );
	}

	/**
	 * @return string
	 */
	public function get_description() {
		return __( 'Adds a toggle to reverse column order on the core Columns block.', 'monk-extensions' );
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
		add_action( 'init', array( $this, 'register_block_styles' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_styles' ) );
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_assets' ) );
		add_filter( 'register_block_type_args', array( $this, 'register_block_attributes' ), 10, 2 );
		add_filter( 'render_block_core/columns', array( $this, 'render_block_columns_reverse' ), 20, 2 );
	}

	/**
	 * Register block styles for core/columns.
	 *
	 * @return void
	 */
	public function register_block_styles() {
		$style_path = __DIR__ . '/assets/css/columns-reverse-order.css';

		if ( ! file_exists( $style_path ) ) {
			return;
		}

		wp_register_style(
			self::STYLE_HANDLE,
			$this->asset_url( 'css/columns-reverse-order.css' ),
			array( 'wp-block-library' ),
			(string) filemtime( $style_path )
		);

		wp_enqueue_block_style(
			'core/columns',
			array(
				'handle' => self::STYLE_HANDLE,
				'src'    => $this->asset_url( 'css/columns-reverse-order.css' ),
				'path'   => $style_path,
			)
		);
	}

	/**
	 * Enqueue stylesheet on the frontend.
	 *
	 * @return void
	 */
	public function enqueue_frontend_styles() {
		if ( is_admin() ) {
			return;
		}

		wp_enqueue_style( self::STYLE_HANDLE );
	}

	/**
	 * Register reverseOrder on the server so it persists in saved content.
	 *
	 * @param array  $args       Block type arguments.
	 * @param string $block_type Block name.
	 * @return array
	 */
	public function register_block_attributes( $args, $block_type ) {
		if ( 'core/columns' !== $block_type ) {
			return $args;
		}

		$args['attributes'] = array_merge(
			isset( $args['attributes'] ) && is_array( $args['attributes'] ) ? $args['attributes'] : array(),
			array(
				'reverseOrder' => array(
					'type'    => 'boolean',
					'default' => false,
				),
			)
		);

		return $args;
	}

	/**
	 * @return void
	 */
	public function enqueue_editor_assets() {
		$style_path  = __DIR__ . '/assets/css/columns-reverse-order.css';
		$script_path = __DIR__ . '/assets/js/columns-reverse-order.js';

		wp_enqueue_style(
			self::STYLE_HANDLE . '-editor',
			$this->asset_url( 'css/columns-reverse-order.css' ),
			array( 'wp-edit-blocks' ),
			(string) filemtime( $style_path )
		);

		wp_enqueue_script(
			'monk-extensions-columns-reverse-order',
			$this->asset_url( 'js/columns-reverse-order.js' ),
			array(
				'wp-block-editor',
				'wp-blocks',
				'wp-components',
				'wp-compose',
				'wp-data',
				'wp-dom-ready',
				'wp-element',
				'wp-hooks',
				'wp-i18n',
			),
			(string) filemtime( $script_path ),
			true
		);
	}

	/**
	 * Ensure has-reverse-order is on the columns wrapper when enabled.
	 *
	 * @param string $block_content Block HTML.
	 * @param array  $block         Block data.
	 * @return string
	 */
	public function render_block_columns_reverse( $block_content, $block ) {
		$attrs           = isset( $block['attrs'] ) ? $block['attrs'] : array();
		$reverse_enabled = ! empty( $attrs['reverseOrder'] );
		$has_class       = false !== strpos( $block_content, 'has-reverse-order' );

		if ( ! $reverse_enabled && ! $has_class ) {
			return $block_content;
		}

		$processor = new \WP_HTML_Tag_Processor( $block_content );

		while ( $processor->next_tag() ) {
			if ( ! $processor->has_class( 'wp-block-columns' ) ) {
				continue;
			}

			if ( ! $processor->has_class( 'has-reverse-order' ) ) {
				$processor->add_class( 'has-reverse-order' );
			}

			return $processor->get_updated_html();
		}

		return $block_content;
	}

	/**
	 * @param string $path Relative path inside the extension assets directory.
	 * @return string
	 */
	private function asset_url( $path ) {
		return plugins_url( 'assets/' . ltrim( $path, '/' ), __FILE__ );
	}
}
