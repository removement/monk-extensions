<?php
/**
 * Extension interface.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions;

defined( 'ABSPATH' ) || exit;

/**
 * Contract for a toggleable Monk Extensions feature.
 */
interface Extension_Interface {

	/**
	 * Unique extension key stored in settings.
	 *
	 * @return string
	 */
	public function get_id();

	/**
	 * Human-readable extension name.
	 *
	 * @return string
	 */
	public function get_label();

	/**
	 * Short description for the settings screen.
	 *
	 * @return string
	 */
	public function get_description();

	/**
	 * Settings group heading slug and label.
	 *
	 * @return array{slug: string, label: string}
	 */
	public function get_group();

	/**
	 * Register hooks, assets, and block integrations.
	 *
	 * @return void
	 */
	public function register();
}
