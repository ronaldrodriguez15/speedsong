<?php

// Credentials stay on the server and are used for read-only sales queries.
return [
    'bodega' => [
        'name' => 'Bodega',
        'url' => env('POS_BODEGA_URL', 'https://sp831.com/bodega'),
        'api_key' => env('POS_BODEGA_API_KEY'),
    ],
    'villa' => [
        'name' => 'Villa',
        'url' => env('POS_VILLA_URL', 'https://sp831.com/villa'),
        'api_key' => env('POS_VILLA_API_KEY'),
    ],
    'local' => [
        'name' => 'Local',
        'url' => env('POS_LOCAL_URL', 'https://sp831.com/local'),
        'api_key' => env('POS_LOCAL_API_KEY'),
    ],
    'bmanga' => [
        'name' => 'Bucaramanga',
        'url' => env('POS_BUCARAMANGA_URL', 'https://sp831.com/bmanga'),
        'api_key' => env('POS_BUCARAMANGA_API_KEY'),
    ],
    'cucuta' => [
        'name' => 'Cúcuta',
        'url' => env('POS_CUCUTA_URL', 'https://sp831.com/cucuta'),
        'api_key' => env('POS_CUCUTA_API_KEY'),
    ],
];
