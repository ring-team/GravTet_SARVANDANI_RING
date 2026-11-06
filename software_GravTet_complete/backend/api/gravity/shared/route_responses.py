"""Shared Flask JSON response helpers for gravity routes."""

from flask import jsonify


def invalid_request_response(message: str = "Invalid request payload"):
    return jsonify({"error": message, "status": "invalid_request"}), 400


def validation_failed_response(message: str):
    return jsonify({"error": message, "status": "validation_failed"}), 400


def library_not_loaded_response(message: str):
    return jsonify({"error": message, "status": "library_not_loaded"}), 503

