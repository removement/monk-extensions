<?php
/**
 * Plugin Name:       Monk Extensions
 * Plugin URI:        https://monk.removement.com
 * Description:       Optional block editor extensions for Monk themes — video modal, responsive grid, link relations, and more.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            Removement
 * Author URI:        https://removement.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       monk-extensions
 *
 * @package MonkExtensions
 */

defined( 'ABSPATH' ) || exit;

define( 'MONK_EXTENSIONS_VERSION', '1.0.0' );
define( 'MONK_EXTENSIONS_FILE', __FILE__ );
define( 'MONK_EXTENSIONS_DIR', plugin_dir_path( __FILE__ ) );
define( 'MONK_EXTENSIONS_URL', plugin_dir_url( __FILE__ ) );

require_once MONK_EXTENSIONS_DIR . 'includes/interface-extension.php';
require_once MONK_EXTENSIONS_DIR . 'includes/class-extension-registry.php';
require_once MONK_EXTENSIONS_DIR . 'includes/class-settings.php';
require_once MONK_EXTENSIONS_DIR . 'includes/class-plugin.php';

register_activation_hook(
	__FILE__,
	static function () {
		if ( false === get_option( MonkExtensions\Settings::OPTION_NAME ) ) {
			update_option( MonkExtensions\Settings::OPTION_NAME, MonkExtensions\Settings::defaults() );
		}
	}
);

MonkExtensions\Plugin::instance();
