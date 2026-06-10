<?php
/**
 * Plugin bootstrap.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions;

defined( 'ABSPATH' ) || exit;

require_once MONK_EXTENSIONS_DIR . 'includes/extensions/video-modal/class-video-modal-extension.php';
require_once MONK_EXTENSIONS_DIR . 'includes/extensions/responsive-grid/class-responsive-grid-extension.php';
require_once MONK_EXTENSIONS_DIR . 'includes/extensions/paragraph-link-relations/class-paragraph-link-relations-extension.php';
require_once MONK_EXTENSIONS_DIR . 'includes/extensions/columns-reverse-order/class-columns-reverse-order-extension.php';

/**
 * Main plugin controller.
 */
final class Plugin {

	/**
	 * @var self|null
	 */
	private static $instance = null;

	/**
	 * @return self
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		add_action( 'plugins_loaded', array( $this, 'init' ) );
	}

	/**
	 * Initialize plugin components.
	 *
	 * @return void
	 */
	public function init() {
		Extension_Registry::add( new Extensions\Video_Modal\Video_Modal_Extension() );
		Extension_Registry::add( new Extensions\Responsive_Grid\Responsive_Grid_Extension() );
		Extension_Registry::add( new Extensions\Paragraph_Link_Relations\Paragraph_Link_Relations_Extension() );
		Extension_Registry::add( new Extensions\Columns_Reverse_Order\Columns_Reverse_Order_Extension() );

		Settings::init();
		Extension_Registry::boot_enabled();
	}
}
