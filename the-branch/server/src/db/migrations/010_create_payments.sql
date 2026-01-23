-- Payments tracking for conversation access
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'single' CHECK (payment_type IN ('single', 'subscription')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conversation_id, reader_id)
);

CREATE INDEX idx_payments_conversation ON payments(conversation_id);
CREATE INDEX idx_payments_reader ON payments(reader_id);
CREATE INDEX idx_payments_status ON payments(status);

-- DOWN

DROP TABLE IF EXISTS payments;
