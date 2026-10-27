<?php
/**
 * Plugin Name: IEI TVLC Staff Portal & Analytics Integration
 * Plugin URI: https://ieitvlc.org/
 * Description: Seamlessly integrates the Institution of Engineers (India) Tiruvallur Local Centre Staff Administration and Analytics Portal into WordPress pages using isolated shortcodes and SSO token handshakes without modifying WordPress core files.
 * Version: 1.0.0
 * Author: IEI TVLC Secretariat & Systems Division
 * Author URI: https://ieitvlc.org/
 * License: Proprietary / Institutional
 * Text Domain: iei-tvlc-portal
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

class IEI_TVLC_Portal_Integration {

    const OPTION_PORTAL_URL = 'iei_tvlc_portal_url';
    const OPTION_SSO_SECRET = 'iei_tvlc_portal_sso_secret';
    const DEFAULT_PORTAL_URL = 'http://localhost:3000';

    public function __construct() {
        add_shortcode('iei_tvlc_portal', array($this, 'render_portal_shortcode'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    /**
     * Registers settings in WordPress Admin
     */
    public function register_settings() {
        register_setting('iei_tvlc_settings_group', self::OPTION_PORTAL_URL, array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => self::DEFAULT_PORTAL_URL
        ));

        register_setting('iei_tvlc_settings_group', self::OPTION_SSO_SECRET, array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => ''
        ));
    }

    /**
     * Adds settings page under the WordPress Settings menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('IEI TVLC Portal Settings', 'iei-tvlc-portal'),
            __('IEI TVLC Portal', 'iei-tvlc-portal'),
            'manage_options',
            'iei-tvlc-portal',
            array($this, 'render_settings_page')
        );
    }

    /**
     * Settings Page HTML
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <p><?php esc_html_e('Configure the standalone IEI TVLC Administration & Analytics Portal integration settings.', 'iei-tvlc-portal'); ?></p>
            
            <div class="notice notice-info inline" style="margin-top: 15px;">
                <p><strong><?php esc_html_e('Institutional Isolation Protocol:', 'iei-tvlc-portal'); ?></strong> <?php esc_html_e('This plugin embeds the external portal via a secure sandbox container and does not modify any WordPress core files or database tables.', 'iei-tvlc-portal'); ?></p>
            </div>

            <form action="options.php" method="post" style="margin-top: 20px;">
                <?php
                settings_fields('iei_tvlc_settings_group');
                do_settings_sections('iei_tvlc_settings_group');
                $portal_url = get_option(self::OPTION_PORTAL_URL, self::DEFAULT_PORTAL_URL);
                $sso_secret = get_option(self::OPTION_SSO_SECRET, '');
                ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="<?php echo esc_attr(self::OPTION_PORTAL_URL); ?>"><?php esc_html_e('Portal Service URL', 'iei-tvlc-portal'); ?></label></th>
                        <td>
                            <input type="url" name="<?php echo esc_attr(self::OPTION_PORTAL_URL); ?>" id="<?php echo esc_attr(self::OPTION_PORTAL_URL); ?>" value="<?php echo esc_attr($portal_url); ?>" class="regular-text" placeholder="https://portal.ieitvlc.org">
                            <p class="description"><?php esc_html_e('The base URL where the Node.js Staff Portal application is running (e.g. https://portal.ieitvlc.org or reverse-proxied /staff-portal).', 'iei-tvlc-portal'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="<?php echo esc_attr(self::OPTION_SSO_SECRET); ?>"><?php esc_html_e('SSO Shared Secret (Optional)', 'iei-tvlc-portal'); ?></label></th>
                        <td>
                            <input type="password" name="<?php echo esc_attr(self::OPTION_SSO_SECRET); ?>" id="<?php echo esc_attr(self::OPTION_SSO_SECRET); ?>" value="<?php echo esc_attr($sso_secret); ?>" class="regular-text">
                            <p class="description"><?php esc_html_e('Optional HMAC secret key matching JWT_SECRET in config.js for seamless WordPress single sign-on.', 'iei-tvlc-portal'); ?></p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(__('Save Settings', 'iei-tvlc-portal')); ?>
            </form>

            <hr style="margin: 30px 0;">
            <h2><?php esc_html_e('How to Embed on a WordPress Page', 'iei-tvlc-portal'); ?></h2>
            <p><?php esc_html_e('To embed the IEI TVLC Staff Administration Portal into any protected WordPress Page or Post, insert the following shortcode:', 'iei-tvlc-portal'); ?></p>
            <code>[iei_tvlc_portal height="900px"]</code>
        </div>
        <?php
    }

    /**
     * Shortcode: [iei_tvlc_portal height="900px" view="dashboard"]
     */
    public function render_portal_shortcode($atts) {
        $atts = shortcode_atts(array(
            'height' => '900px',
            'min_height' => '650px',
            'border' => '0',
            'view' => 'dashboard'
        ), $atts, 'iei_tvlc_portal');

        $base_url = get_option(self::OPTION_PORTAL_URL, self::DEFAULT_PORTAL_URL);
        $clean_base = rtrim($base_url, '/');
        $target_url = $clean_base . '/#' . sanitize_key($atts['view']);

        // Check if user is logged in to WordPress
        $current_user = wp_get_current_user();
        if ($current_user && $current_user->ID > 0) {
            $sso_secret = get_option(self::OPTION_SSO_SECRET, '');
            if (!empty($sso_secret)) {
                $token_payload = base64_encode(json_encode(array(
                    'wp_uid' => $current_user->ID,
                    'email' => $current_user->user_email,
                    'name' => $current_user->display_name,
                    'time' => time()
                )));
                $token_sig = hash_hmac('sha256', $token_payload, $sso_secret);
                $target_url .= '?sso=' . urlencode($token_payload . '.' . $token_sig);
            }
        }

        $container_id = 'iei-portal-frame-' . wp_rand(1000, 9999);

        ob_start();
        ?>
        <div class="iei-tvlc-portal-wrapper" style="width: 100%; margin: 20px 0; clear: both;">
            <iframe 
                id="<?php echo esc_attr($container_id); ?>"
                src="<?php echo esc_url($target_url); ?>" 
                width="100%" 
                height="<?php echo esc_attr($atts['height']); ?>" 
                style="border: none; min-height: <?php echo esc_attr($atts['min_height']); ?>; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,43,73,0.08); background: #F4F6F9;"
                allow="fullscreen; clipboard-write"
                title="<?php esc_attr_e('IEI TVLC Administration and Analytics Portal', 'iei-tvlc-portal'); ?>">
            </iframe>
        </div>
        <script>
            (function() {
                var iframe = document.getElementById('<?php echo esc_js($container_id); ?>');
                if (!iframe) return;
                window.addEventListener('message', function(event) {
                    if (event.origin !== '<?php echo esc_js($clean_base); ?>') return;
                    if (event.data && event.data.type === 'iei_resize' && event.data.height) {
                        iframe.style.height = event.data.height + 'px';
                    }
                });
            })();
        </script>
        <?php
        return ob_get_clean();
    }
}

new IEI_TVLC_Portal_Integration();
