# -*- coding: utf-8 -*-
from __future__ import annotations

from app.plates import extract_plate_numbers


def test_extract_plate_numbers_basic():
    text = "Продам авто A123BC77 и ещё X777XX777"
    plates = extract_plate_numbers(text)
    assert "A123BC77" in plates
