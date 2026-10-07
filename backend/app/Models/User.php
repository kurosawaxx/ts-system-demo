<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'password', 'role', 'day_cost', 'employee_code', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'day_cost' => 'decimal:2',
            'is_active' => 'boolean',
            // 無効化(退職等)した日時。有効化でクリアする。論理削除の deleted_at を引き継いだもので、
            // グローバルスコープを持たないため書き忘れで静かに消えることはない。
            'deactivated_at' => 'datetime',
        ];
    }

    public function projects()
    {
        return $this->belongsToMany(Project::class)->withTimestamps();
    }

    public function workHours()
    {
        return $this->hasMany(WorkHour::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isDirector(): bool
    {
        return $this->role === 'director';
    }
}
