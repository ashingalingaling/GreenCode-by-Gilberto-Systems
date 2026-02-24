<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"));

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Not logged in']);
    exit;
}

if (!empty($data->password)) {
    // Hash the new password securely
    $hash = password_hash($data->password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    
    if ($stmt->execute([$hash, $_SESSION['user_id']])) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Database error']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Password cannot be empty']);
}
?>