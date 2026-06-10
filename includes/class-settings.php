<?php
/**
 * Plugin settings.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions;

defined( 'ABSPATH' ) || exit;

/**
 * Settings storage, REST API, and admin page.
 */
final class Settings {

	public const OPTION_NAME = 'monk_extensions_settings';
	public const PAGE_SLUG   = 'monk-extensions';

	/**
	 * Default enabled extensions.
	 *
	 * @return array<string, bool>
	 */
	public static function defaults() {
		return array(
			'video_modal'              => true,
			'responsive_grid'          => true,
			'paragraph_link_relations' => true,
			'columns_reverse_order'    => true,
		);
	}

	/**
	 * Current settings merged with defaults.
	 *
	 * @return array<string, bool>
	 */
	public static function get() {
		$stored = get_option( self::OPTION_NAME, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		$sanitized = array();
		foreach ( self::defaults() as $key => $default ) {
			$sanitized[ $key ] = isset( $stored[ $key ] ) ? (bool) $stored[ $key ] : (bool) $default;
		}

		return $sanitized;
	}

	/**
	 * Sanitize settings payload.
	 *
	 * @param mixed $value Raw value.
	 * @return array<string, bool>
	 */
	public static function sanitize( $value ) {
		if ( ! is_array( $value ) ) {
			return self::defaults();
		}

		$sanitized = self::defaults();

		foreach ( array_keys( $sanitized ) as $key ) {
			$sanitized[ $key ] = ! empty( $value[ $key ] );
		}

		return $sanitized;
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'register_setting' ) );
		add_action( 'admin_menu', array( __CLASS__, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_admin_assets' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest_routes' ) );
		add_filter(
			'plugin_action_links_' . plugin_basename( MONK_EXTENSIONS_FILE ),
			array( __CLASS__, 'add_plugin_action_link' )
		);
	}

	/**
	 * Register the settings option.
	 *
	 * @return void
	 */
	public static function register_setting() {
		register_setting(
			'monk_extensions',
			self::OPTION_NAME,
			array(
				'type'              => 'object',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => self::defaults(),
			)
		);
	}

	/**
	 * Settings submenu under Settings.
	 *
	 * @return void
	 */
	public static function register_menu() {
		add_options_page(
			__( 'Monk Extensions', 'monk-extensions' ),
			__( 'Monk Extensions', 'monk-extensions' ),
			'manage_options',
			self::PAGE_SLUG,
			array( __CLASS__, 'render_page' )
		);
	}

	/**
	 * Link from the plugins list table.
	 *
	 * @param array<int, string> $links Plugin action links.
	 * @return array<int, string>
	 */
	public static function add_plugin_action_link( $links ) {
		$settings_link = sprintf(
			'<a href="%s">%s</a>',
			esc_url( admin_url( 'options-general.php?page=' . self::PAGE_SLUG ) ),
			esc_html__( 'Settings', 'monk-extensions' )
		);

		array_unshift( $links, $settings_link );

		return $links;
	}

	/**
	 * REST routes for the React settings UI.
	 *
	 * @return void
	 */
	public static function register_rest_routes() {
		$setting_args = array();
		foreach ( array_keys( self::defaults() ) as $key ) {
			$setting_args[ $key ] = array( 'type' => 'boolean' );
		}

		register_rest_route(
			'monk-extensions/v1',
			'/settings',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( __CLASS__, 'rest_get_settings' ),
					'permission_callback' => array( __CLASS__, 'rest_permissions_check' ),
				),
				array(
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => array( __CLASS__, 'rest_update_settings' ),
					'permission_callback' => array( __CLASS__, 'rest_permissions_check' ),
					'args'                => $setting_args,
				),
			)
		);

		register_rest_route(
			'monk-extensions/v1',
			'/extensions',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'rest_get_extensions' ),
				'permission_callback' => array( __CLASS__, 'rest_permissions_check' ),
			)
		);
	}

	/**
	 * @return bool
	 */
	public static function rest_permissions_check() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * @return \WP_REST_Response
	 */
	public static function rest_get_settings() {
		return rest_ensure_response( self::get() );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public static function rest_update_settings( $request ) {
		$payload = array();

		foreach ( array_keys( self::defaults() ) as $key ) {
			$payload[ $key ] = (bool) $request->get_param( $key );
		}

		update_option( self::OPTION_NAME, self::sanitize( $payload ) );

		return rest_ensure_response( self::get() );
	}

	/**
	 * @return \WP_REST_Response
	 */
	public static function rest_get_extensions() {
		return rest_ensure_response( Extension_Registry::get_settings_groups() );
	}

	/**
	 * Enqueue admin assets on the settings screen.
	 *
	 * @param string $hook_suffix Admin page hook.
	 * @return void
	 */
	public static function enqueue_admin_assets( $hook_suffix ) {
		if ( 'settings_page_' . self::PAGE_SLUG !== $hook_suffix ) {
			return;
		}

		$style_path = MONK_EXTENSIONS_DIR . 'assets/admin/css/settings.css';
		$script_path = MONK_EXTENSIONS_DIR . 'assets/admin/js/settings.js';

		wp_enqueue_style(
			'monk-extensions-settings',
			MONK_EXTENSIONS_URL . 'assets/admin/css/settings.css',
			array( 'wp-components' ),
			(string) filemtime( $style_path )
		);

		wp_enqueue_script(
			'monk-extensions-settings',
			MONK_EXTENSIONS_URL . 'assets/admin/js/settings.js',
			array(
				'wp-api-fetch',
				'wp-components',
				'wp-data',
				'wp-element',
				'wp-i18n',
			),
			(string) filemtime( $script_path ),
			true
		);

		wp_set_script_translations( 'monk-extensions-settings', 'monk-extensions', MONK_EXTENSIONS_DIR . 'languages' );

		wp_add_inline_script(
			'monk-extensions-settings',
			'wp.apiFetch.use( wp.apiFetch.createNonceMiddleware( ' . wp_json_encode( wp_create_nonce( 'wp_rest' ) ) . ' ) );',
			'before'
		);
	}

	/**
	 * Render the settings mount point.
	 *
	 * @return void
	 */
	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div id="monk-extensions-settings-app" class="boot-layout-container" aria-live="polite"></div>
		<?php
	}
}
