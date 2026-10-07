<?php

// SortDirection enum (PHP 8.6+) をPHP 8.3環境で使えるようにするpolyfill
// symfony/polyfill-php86のclassmapエントリが正常に生成されない場合の安全策
if (PHP_VERSION_ID >= 80100 && PHP_VERSION_ID < 80600 && !class_exists('SortDirection', false)) {
    if (!class_exists('SortDirection', true)) {
        eval('enum SortDirection { case Ascending; case Descending; }');
    }
}

// request_parse_body() (PHP 8.4+) をPHP 8.3環境で使えるようにするpolyfill
// symfony/http-foundation 8.0.x がPUT/PATCH/DELETEリクエスト時に呼び出す
if (!function_exists('request_parse_body')) {
    function request_parse_body(): array {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

        if (str_contains($contentType, 'application/x-www-form-urlencoded')) {
            parse_str((string) file_get_contents('php://input'), $data);
            return [$data, []];
        }

        if (str_contains($contentType, '/json') || str_contains($contentType, '+json')) {
            $body = (string) file_get_contents('php://input');
            if ($body !== '') {
                $decoded = json_decode($body, true);
                return [is_array($decoded) ? $decoded : [], []];
            }
        }

        return [[], []];
    }
}
