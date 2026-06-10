<?php
/**
 * Extension registry.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions;

defined( 'ABSPATH' ) || exit;

/**
 * Registers and boots enabled extensions.
 */
final class Extension_Registry {

	/**
	 * Registered extensions keyed by ID.
	 *
	 * @var array<string, Extension_Interface>
	 */
	private static $extensions = array();

	/**
	 * Register an extension instance.
	 *
	 * @param Extension_Interface $extension Extension.
	 * @return void
	 */
	public static function add( Extension_Interface $extension ) {
		self::$extensions[ $extension->get_id() ] = $extension;
	}

	/**
	 * All registered extensions.
	 *
	 * @return array<string, Extension_Interface>
	 */
	public static function all() {
		return self::$extensions;
	}

	/**
	 * Extension metadata for the settings UI.
	 *
	 * @return array<int, array{slug: string, label: string, items: array<int, array{id: string, label: string, description: string}>}>
	 */
	public static function get_settings_groups() {
		$groups = array();

		foreach ( self::$extensions as $extension ) {
			$group = $extension->get_group();

			if ( ! isset( $groups[ $group['slug'] ] ) ) {
				$groups[ $group['slug'] ] = array(
					'slug'  => $group['slug'],
					'label' => $group['label'],
					'items' => array(),
				);
			}

			$groups[ $group['slug'] ]['items'][] = array(
				'id'          => $extension->get_id(),
				'label'       => $extension->get_label(),
				'description' => $extension->get_description(),
			);
		}

		return array_values( $groups );
	}

	/**
	 * Boot extensions that are enabled in settings.
	 *
	 * @return void
	 */
	public static function boot_enabled() {
		$settings = Settings::get();

		foreach ( self::$extensions as $id => $extension ) {
			if ( empty( $settings[ $id ] ) ) {
				continue;
			}

			$extension->register();
		}
	}
}
