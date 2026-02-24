<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"));

if (!empty($data->username) && !empty($data->password)) {
    $hash = password_hash($data->password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
    try {
        $stmt->execute([$data->username, $hash]);
        $user_id = $pdo->lastInsertId();
        $_SESSION['user_id'] = $user_id;
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => 'Username already exists']);
    }
}
?>