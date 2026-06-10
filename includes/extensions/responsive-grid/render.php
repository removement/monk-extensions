<?php
/**
 * Responsive Grid Breakpoints render layer.
 *
 * @package MonkExtensions
 */

namespace MonkExtensions\Extensions\Responsive_Grid;

defined( 'ABSPATH' ) || exit;

/**
 * Registers responsive grid breakpoint hooks.
 */
final class Grid_Breakpoints {

	/**
	 * Register WordPress hooks for this extension.
	 *
	 * @return void
	 */
	public static function register_hooks() {
		add_filter( 'register_block_type_args', array( __CLASS__, 'register_attributes' ), 10, 2 );
		add_filter( 'pre_render_block', array( __CLASS__, 'pre_render_group_grid_breakpoints' ), 10, 2 );
		add_filter( 'render_block_data', array( __CLASS__, 'mark_direct_grid_child' ), 10, 3 );
		add_filter( 'render_block', array( __CLASS__, 'render_group_grid_breakpoints' ), 10, 2 );
		add_filter( 'render_block', array( __CLASS__, 'render_grid_item_span_breakpoints' ), 11, 2 );
	}

	/**
	 * @param array  $args       Block type arguments.
	 * @param string $block_type Block name.
	 * @return array
	 */
	public static function register_attributes( $args, $block_type ) {
		return monk_register_grid_breakpoints_attributes( $args, $block_type );
	}

	/**
	 * @param string|null $pre_render   Pre-rendered content.
	 * @param array       $parsed_block Parsed block.
	 * @return string|null
	 */
	public static function pre_render_group_grid_breakpoints( $pre_render, $parsed_block ) {
		return monk_pre_render_group_grid_breakpoints( $pre_render, $parsed_block );
	}

	/**
	 * @param array         $parsed_block Parsed block.
	 * @param array         $source_block Source block.
	 * @param \WP_Block|null $parent_block Parent block instance.
	 * @return array
	 */
	public static function mark_direct_grid_child( $parsed_block, $source_block, $parent_block ) {
		return monk_mark_direct_grid_child( $parsed_block, $source_block, $parent_block );
	}

	/**
	 * @param string $block_content Block HTML.
	 * @param array  $block         Block data.
	 * @return string
	 */
	public static function render_group_grid_breakpoints( $block_content, $block ) {
		return monk_render_group_grid_breakpoints( $block_content, $block );
	}

	/**
	 * @param string $block_content Block HTML.
	 * @param array  $block         Block data.
	 * @return string
	 */
	public static function render_grid_item_span_breakpoints( $block_content, $block ) {
		return monk_render_grid_item_span_breakpoints( $block_content, $block );
	}
}

/**
 * Parent grid breakpoint stack (supports nested grid groups).
 *
 * @var array<int, array<int, array{width: int, columns: int, rows?: int}>>
 */
$monk_grid_breakpoint_stack = array();

/**
 * Push parent breakpoint rows onto the render stack.
 *
 * @param array $rows Normalized parent rows.
 * @return void
 */
function monk_grid_breakpoint_stack_push( $rows ) {
	global $monk_grid_breakpoint_stack;

	$monk_grid_breakpoint_stack[] = $rows;
}

/**
 * Pop the latest parent breakpoint rows from the render stack.
 *
 * @return array<int, array{width: int, columns: int, rows?: int}>
 */
function monk_grid_breakpoint_stack_pop() {
	global $monk_grid_breakpoint_stack;

	if ( empty( $monk_grid_breakpoint_stack ) ) {
		return array();
	}

	return array_pop( $monk_grid_breakpoint_stack );
}

/**
 * Peek at the current parent breakpoint rows on the render stack.
 *
 * @return array<int, array{width: int, columns: int, rows?: int}>
 */
function monk_grid_breakpoint_stack_peek() {
	global $monk_grid_breakpoint_stack;

	if ( empty( $monk_grid_breakpoint_stack ) ) {
		return array();
	}

	return $monk_grid_breakpoint_stack[ count( $monk_grid_breakpoint_stack ) - 1 ];
}

/**
 * Register responsive grid attributes on block types.
 *
 * @param array  $args       Block type arguments.
 * @param string $block_type Block name.
 * @return array
 */
function monk_register_grid_breakpoints_attributes( $args, $block_type ) {
	if ( 'core/group' === $block_type ) {
		$args['attributes']['monkGridBreakpoints'] = array(
			'type'    => 'array',
			'default' => array(),
		);
	}

	$args['attributes']['monkGridItemSpanBreakpoints'] = array(
		'type'    => 'array',
		'default' => array(),
	);

	return $args;
}
/**
 * Whether a group block uses grid layout.
 *
 * @param array  $block         Block data.
 * @param string $block_content Optional rendered HTML.
 * @return bool
 */
function monk_is_group_grid_block( $block, $block_content = '' ) {
	$attrs = isset( $block['attrs'] ) ? $block['attrs'] : array();

	if ( ! empty( $attrs['layout']['type'] ) && 'grid' === $attrs['layout']['type'] ) {
		return true;
	}

	$class_name = isset( $attrs['className'] ) ? $attrs['className'] : '';
	if ( false !== strpos( $class_name, 'is-layout-grid' ) ) {
		return true;
	}

	$html = $block_content;
	if ( empty( $html ) && ! empty( $block['innerHTML'] ) ) {
		$html = $block['innerHTML'];
	}

	if ( ! empty( $html ) && false !== strpos( $html, 'is-layout-grid' ) ) {
		return true;
	}

	return false;
}

/**
 * Whether a block can use grid child layout (matches core layout-child hook).
 *
 * @param string $block_name Block name.
 * @return bool
 */
function monk_block_supports_grid_span( $block_name ) {
	if ( empty( $block_name ) ) {
		return false;
	}

	$block_type = \WP_Block_Type_Registry::get_instance()->get_registered( $block_name );

	if ( ! $block_type ) {
		return false;
	}

	if ( block_has_support( $block_type, 'layout', false ) || block_has_support( $block_type, '__experimentalLayout', false ) ) {
		return true;
	}

	$style_support_keys = array(
		'color',
		'typography',
		'spacing',
		'dimensions',
		'border',
		'background',
		'shadow',
		'filter',
	);

	foreach ( $style_support_keys as $support_key ) {
		if ( block_has_support( $block_type, $support_key, false ) ) {
			return true;
		}
	}

	if ( block_has_support( $block_type, '__experimentalBorder', false ) ) {
		return true;
	}

	if ( ! empty( $block_type->attributes['style'] ) ) {
		return true;
	}

	return false;
}

/**
 * Sanitize and sort parent breakpoint rows.
 *
 * @param mixed $rows Raw breakpoint rows.
 * @return array<int, array{width: int, columns: int, rows?: int}>
 */
function monk_normalize_grid_breakpoints( $rows ) {
	if ( ! is_array( $rows ) ) {
		return array();
	}

	$normalized = array();

	foreach ( $rows as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}

		$width   = isset( $row['width'] ) ? absint( $row['width'] ) : 0;
		$columns = isset( $row['columns'] ) ? absint( $row['columns'] ) : 0;

		if ( $width < 1 || $columns < 1 ) {
			continue;
		}

		$columns = min( $columns, 16 );

		$item = array(
			'width'   => $width,
			'columns' => $columns,
		);

		if ( isset( $row['rows'] ) && absint( $row['rows'] ) > 0 ) {
			$item['rows'] = min( absint( $row['rows'] ), 16 );
		}

		$normalized[ $width ] = $item;
	}

	ksort( $normalized, SORT_NUMERIC );

	return array_values( $normalized );
}

/**
 * Sanitize and sort child span breakpoint rows.
 *
 * @param mixed $rows Raw span rows.
 * @return array<int, array{width: int, columnSpan: int, rowSpan: int}>
 */
function monk_normalize_grid_item_span_breakpoints( $rows ) {
	if ( ! is_array( $rows ) ) {
		return array();
	}

	$normalized = array();

	foreach ( $rows as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}

		$width      = isset( $row['width'] ) ? absint( $row['width'] ) : 0;
		$column_span = isset( $row['columnSpan'] ) ? absint( $row['columnSpan'] ) : 0;
		$row_span    = isset( $row['rowSpan'] ) ? absint( $row['rowSpan'] ) : 0;

		if ( $width < 1 || $column_span < 1 || $row_span < 1 ) {
			continue;
		}

		$normalized[ $width ] = array(
			'width'      => $width,
			'columnSpan' => min( $column_span, 16 ),
			'rowSpan'    => min( $row_span, 16 ),
		);
	}

	ksort( $normalized, SORT_NUMERIC );

	return array_values( $normalized );
}

/**
 * Get parent column count at a breakpoint width from parent rows.
 *
 * @param array $parent_rows Normalized parent rows.
 * @param int   $width       Breakpoint width.
 * @return int
 */
function monk_get_parent_grid_column_count_at_width( $parent_rows, $width ) {
	foreach ( $parent_rows as $row ) {
		if ( (int) $row['width'] === (int) $width ) {
			return (int) $row['columns'];
		}
	}

	return 16;
}

/**
 * Default grid span from core style.layout on a block.
 *
 * @param array $attrs Block attributes.
 * @return array{columnSpan: int, rowSpan: int}
 */
function monk_get_default_grid_span_from_attrs( $attrs ) {
	$layout      = isset( $attrs['style']['layout'] ) && is_array( $attrs['style']['layout'] ) ? $attrs['style']['layout'] : array();
	$column_span = isset( $layout['columnSpan'] ) ? absint( $layout['columnSpan'] ) : 1;
	$row_span    = isset( $layout['rowSpan'] ) ? absint( $layout['rowSpan'] ) : 1;

	if ( ! empty( $layout['columnStart'] ) && ! empty( $layout['columnEnd'] ) ) {
		$column_span = absint( $layout['columnEnd'] ) - absint( $layout['columnStart'] ) + 1;
	}
	if ( ! empty( $layout['rowStart'] ) && ! empty( $layout['rowEnd'] ) ) {
		$row_span = absint( $layout['rowEnd'] ) - absint( $layout['rowStart'] ) + 1;
	}

	return array(
		'columnSpan' => min( max( 1, $column_span ), 16 ),
		'rowSpan'    => min( max( 1, $row_span ), 16 ),
	);
}

/**
 * Resolve effective child span rows at every parent breakpoint for CSS output.
 *
 * Emits a rule per parent width so narrower max-width queries override wider ones
 * (e.g. span 2 at 1024px does not persist at 600px when the parent has one column).
 *
 * @param array $attrs       Child block attributes.
 * @param array $parent_rows Normalized parent rows.
 * @return array<int, array{width: int, columnSpan: int, rowSpan: int}>
 */
function monk_resolve_child_span_rows_for_render( $attrs, $parent_rows ) {
	if ( empty( $parent_rows ) ) {
		return array();
	}

	$default_span  = monk_get_default_grid_span_from_attrs( $attrs );
	$explicit_rows = monk_filter_child_span_rows_to_parent(
		monk_normalize_grid_item_span_breakpoints(
			isset( $attrs['monkGridItemSpanBreakpoints'] ) ? $attrs['monkGridItemSpanBreakpoints'] : array()
		),
		$parent_rows
	);

	$explicit_by_width = array();
	foreach ( $explicit_rows as $row ) {
		$explicit_by_width[ (int) $row['width'] ] = $row;
	}

	$resolved = array();

	foreach ( $parent_rows as $parent_row ) {
		$width       = (int) $parent_row['width'];
		$max_columns = (int) $parent_row['columns'];

		if ( isset( $explicit_by_width[ $width ] ) ) {
			$column_span = (int) $explicit_by_width[ $width ]['columnSpan'];
			$row_span    = (int) $explicit_by_width[ $width ]['rowSpan'];
		} else {
			$column_span = (int) $default_span['columnSpan'];
			$row_span    = (int) $default_span['rowSpan'];
		}

		$column_span = min( max( 1, $column_span ), $max_columns );
		$row_span    = max( 1, $row_span );

		if ( ! empty( $parent_row['rows'] ) ) {
			$row_span = min( $row_span, (int) $parent_row['rows'] );
		}

		$resolved[ $width ] = array(
			'width'      => $width,
			'columnSpan' => $column_span,
			'rowSpan'    => $row_span,
		);
	}

	ksort( $resolved, SORT_NUMERIC );

	return array_values( $resolved );
}

/**
 * Filter child span rows to widths allowed by the parent stack.
 *
 * @param array $child_rows  Normalized child rows.
 * @param array $parent_rows Normalized parent rows.
 * @return array<int, array{width: int, columnSpan: int, rowSpan: int}>
 */
function monk_filter_child_span_rows_to_parent( $child_rows, $parent_rows ) {
	if ( empty( $parent_rows ) || empty( $child_rows ) ) {
		return array();
	}

	$allowed = array();

	foreach ( $parent_rows as $row ) {
		$allowed[ (int) $row['width'] ] = true;
	}

	$filtered = array();

	foreach ( $child_rows as $row ) {
		$width = (int) $row['width'];

		if ( empty( $allowed[ $width ] ) ) {
			continue;
		}

		$max_columns = monk_get_parent_grid_column_count_at_width( $parent_rows, $width );

		$filtered[] = array(
			'width'      => $width,
			'columnSpan' => min( (int) $row['columnSpan'], $max_columns ),
			'rowSpan'    => (int) $row['rowSpan'],
		);
	}

	return $filtered;
}

/**
 * Build scoped CSS for parent grid breakpoints (larger widths first).
 *
 * @param string $scope_class Unique scope class.
 * @param array  $rows        Normalized breakpoints.
 * @return string
 */
function monk_build_group_grid_breakpoints_css( $scope_class, $rows ) {
	if ( empty( $rows ) ) {
		return '';
	}

	$css  = '';
	$rows = array_reverse( $rows );

	foreach ( $rows as $row ) {
		$width   = (int) $row['width'];
		$columns = (int) $row['columns'];
		$rules   = sprintf(
			'grid-template-columns:repeat(%1$d,minmax(0,1fr))!important',
			$columns
		);

		if ( ! empty( $row['rows'] ) ) {
			$rules .= sprintf(
				';grid-template-rows:repeat(%1$d,minmax(0,1fr))!important',
				(int) $row['rows']
			);
		}

		$css .= sprintf(
			'@media (max-width:%1$dpx){.wp-block-group.%2$s.is-layout-grid,.wp-block-group.%2$s{%3$s}}',
			$width,
			esc_attr( $scope_class ),
			$rules
		);
	}

	return $css;
}

/**
 * Build scoped CSS for child grid span breakpoints (larger widths first).
 *
 * @param string $scope_class Unique scope class.
 * @param array  $rows        Normalized child span rows.
 * @return string
 */
function monk_build_grid_item_span_breakpoints_css( $scope_class, $rows ) {
	if ( empty( $rows ) ) {
		return '';
	}

	$css  = '';
	$rows = array_reverse( $rows );

	foreach ( $rows as $row ) {
		$width = (int) $row['width'];

		$css .= sprintf(
			'@media (max-width:%1$dpx){.%2$s{grid-column:span %3$d!important;grid-row:span %4$d!important}}',
			$width,
			esc_attr( $scope_class ),
			(int) $row['columnSpan'],
			(int) $row['rowSpan']
		);
	}

	return $css;
}

/**
 * Add scoped class to the first HTML tag.
 *
 * @param string $block_content Block HTML.
 * @param string $scope_class   Scope class.
 * @return string
 */
function monk_add_scope_class_to_block_content( $block_content, $scope_class ) {
	$p = new \WP_HTML_Tag_Processor( $block_content );

	if ( ! $p->next_tag() ) {
		return $block_content;
	}

	$p->add_class( $scope_class );

	return $p->get_updated_html();
}

/**
 * Push parent breakpoint context before rendering a grid group.
 *
 * @param string|null $pre_render   Pre-rendered content.
 * @param array       $parsed_block Parsed block.
 * @return string|null
 */
function monk_pre_render_group_grid_breakpoints( $pre_render, $parsed_block ) {
	if ( empty( $parsed_block['blockName'] ) || 'core/group' !== $parsed_block['blockName'] ) {
		return $pre_render;
	}

	$attrs = isset( $parsed_block['attrs'] ) ? $parsed_block['attrs'] : array();
	$rows  = monk_normalize_grid_breakpoints( isset( $attrs['monkGridBreakpoints'] ) ? $attrs['monkGridBreakpoints'] : array() );

	if ( empty( $rows ) || ! monk_is_group_grid_block( $parsed_block ) ) {
		return $pre_render;
	}

	monk_grid_breakpoint_stack_push( $rows );

	return $pre_render;
}
/**
 * Mark direct children of grid group blocks during render.
 *
 * @param array         $parsed_block Parsed block.
 * @param array         $source_block Source block.
 * @param WP_Block|null $parent_block Parent block instance.
 * @return array
 */
function monk_mark_direct_grid_child( $parsed_block, $source_block, $parent_block ) {
	if ( ! $parent_block instanceof \WP_Block || empty( $parent_block->name ) || 'core/group' !== $parent_block->name ) {
		return $parsed_block;
	}

	$parent_attrs = isset( $parent_block->parsed_block['attrs'] ) ? $parent_block->parsed_block['attrs'] : array();

	if ( empty( $parent_attrs['layout']['type'] ) || 'grid' !== $parent_attrs['layout']['type'] ) {
		return $parsed_block;
	}

	$parsed_block['monkDirectGridChild'] = true;

	return $parsed_block;
}
/**
 * Output scoped parent grid breakpoint CSS on grid group blocks.
 *
 * @param string $block_content Block HTML.
 * @param array  $block         Block data.
 * @return string
 */
function monk_render_group_grid_breakpoints( $block_content, $block ) {
	if ( empty( $block['blockName'] ) || 'core/group' !== $block['blockName'] ) {
		return $block_content;
	}

	$attrs = isset( $block['attrs'] ) ? $block['attrs'] : array();
	$rows  = monk_normalize_grid_breakpoints( isset( $attrs['monkGridBreakpoints'] ) ? $attrs['monkGridBreakpoints'] : array() );

	$pushed_context = ! empty( $rows ) && monk_is_group_grid_block( $block, $block_content );

	try {
		if ( empty( $rows ) || ! monk_is_group_grid_block( $block, $block_content ) ) {
			return $block_content;
		}

		$scope_class = function_exists( 'wp_unique_id' )
			? wp_unique_id( 'monk-grid-breakpoints-' )
			: 'monk-grid-breakpoints-' . wp_generate_password( 8, false, false );

		$updated_html = monk_add_scope_class_to_block_content( $block_content, $scope_class );
		$css          = monk_build_group_grid_breakpoints_css( $scope_class, $rows );

		if ( '' === $css ) {
			return $updated_html;
		}

		return $updated_html . '<style>' . $css . '</style>';
	} finally {
		if ( $pushed_context ) {
			monk_grid_breakpoint_stack_pop();
		}
	}
}
/**
 * Output scoped child grid span breakpoint CSS on direct grid children.
 *
 * @param string $block_content Block HTML.
 * @param array  $block         Block data.
 * @return string
 */
function monk_render_grid_item_span_breakpoints( $block_content, $block ) {
	if ( empty( $block['monkDirectGridChild'] ) ) {
		return $block_content;
	}

	if ( empty( $block['blockName'] ) || ! monk_block_supports_grid_span( $block['blockName'] ) ) {
		return $block_content;
	}

	$parent_rows = monk_grid_breakpoint_stack_peek();

	if ( empty( $parent_rows ) ) {
		return $block_content;
	}

	$attrs      = isset( $block['attrs'] ) ? $block['attrs'] : array();
	$child_rows = monk_resolve_child_span_rows_for_render( $attrs, $parent_rows );

	if ( empty( $child_rows ) ) {
		return $block_content;
	}

	$scope_class = function_exists( 'wp_unique_id' )
		? wp_unique_id( 'monk-grid-item-span-' )
		: 'monk-grid-item-span-' . wp_generate_password( 8, false, false );

	$updated_html = monk_add_scope_class_to_block_content( $block_content, $scope_class );
	$css          = monk_build_grid_item_span_breakpoints_css( $scope_class, $child_rows );

	if ( '' === $css ) {
		return $updated_html;
	}

	return $updated_html . '<style>' . $css . '</style>';
}
