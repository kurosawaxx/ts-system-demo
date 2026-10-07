<?php

namespace Tests\Feature;

use Tests\TestCase;

class FrameworkEnvironmentIsolationTest extends TestCase
{
    /**
     * Laravelブート後にconfig('database.default')が実際にsqliteを指しているかを、
     * DBに一切触れずに確認する(RefreshDatabaseは使わない)。
     */
    public function test_laravel_resolves_sqlite_connection_in_tests(): void
    {
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertSame('sqlite', env('DB_CONNECTION'));
    }
}
