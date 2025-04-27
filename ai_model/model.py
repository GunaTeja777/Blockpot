import os
import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import Embedding, LSTM, Dense, Dropout, Bidirectional
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

class CommandClassifier:
    def __init__(self, model_path=None):
        self.tokenizer = None
        self.label_encoder = None
        self.model = None
        self.max_length = 100
        self.vocab_size = 5000
        self.embedding_dim = 128
        self.classes = ['safe', 'suspicious', 'malicious']
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
    
    def preprocess_data(self, data):
        """Preprocess commands data for training"""
        # Create and fit tokenizer
        self.tokenizer = Tokenizer(num_words=self.vocab_size, oov_token="<OOV>")
        self.tokenizer.fit_on_texts(data['command'])
        
        # Convert text to sequences
        sequences = self.tokenizer.texts_to_sequences(data['command'])
        padded_sequences = pad_sequences(sequences, maxlen=self.max_length, padding='post')
        
        # Encode labels
        self.label_encoder = LabelEncoder()
        labels = self.label_encoder.fit_transform(data['classification'])
        
        return padded_sequences, labels
    
    def build_model(self):
        """Build and compile the LSTM model"""
        model = Sequential([
            Embedding(self.vocab_size, self.embedding_dim, input_length=self.max_length),
            Bidirectional(LSTM(64, return_sequences=True)),
            Bidirectional(LSTM(32)),
            Dense(64, activation='relu'),
            Dropout(0.5),
            Dense(len(self.classes), activation='softmax')
        ])
        
        model.compile(
            loss='sparse_categorical_crossentropy',
            optimizer='adam',
            metrics=['accuracy']
        )
        
        self.model = model
        return model
    
    def train(self, data_file, epochs=20, batch_size=32):
        """Train the model on the provided data"""
        # Load data
        data = pd.read_csv(data_file)
        
        # Preprocess data
        X, y = self.preprocess_data(data)
        
        # Split the data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Build model if not loaded
        if self.model is None:
            self.build_model()
        
        # Callbacks
        early_stopping = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)
        model_checkpoint = ModelCheckpoint(
            filepath='best_command_classifier.h5',
            monitor='val_accuracy',
            save_best_only=True
        )
        
        # Train the model
        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=[early_stopping, model_checkpoint]
        )
        
        # Evaluate on test data
        loss, accuracy = self.model.evaluate(X_test, y_test)
        print(f"Test Accuracy: {accuracy:.4f}")
        
        return history
    
    def predict(self, command):
        """Classify a shell command"""
        if not self.tokenizer or not self.model:
            raise ValueError("Model not trained or loaded")
        
        # Preprocess the command
        sequence = self.tokenizer.texts_to_sequences([command])
        padded = pad_sequences(sequence, maxlen=self.max_length, padding='post')
        
        # Get predictions
        prediction = self.model.predict(padded)[0]
        predicted_class_index = np.argmax(prediction)
        
        # Map index back to class label
        if self.label_encoder:
            predicted_class = self.label_encoder.inverse_transform([predicted_class_index])[0]
        else:
            predicted_class = self.classes[predicted_class_index]
        
        confidence = prediction[predicted_class_index]
        
        return {
            'command': command,
            'classification': predicted_class,
            'confidence': float(confidence),
            'probabilities': {
                'safe': float(prediction[self.label_encoder.transform(['safe'])[0]]),
                'suspicious': float(prediction[self.label_encoder.transform(['suspicious'])[0]]),
                'malicious': float(prediction[self.label_encoder.transform(['malicious'])[0]])
            }
        }
    
    def save_model(self, model_path='command_classifier_model'):
        """Save the model and tokenizer"""
        if not os.path.exists(model_path):
            os.makedirs(model_path)
        
        # Save the model
        self.model.save(os.path.join(model_path, 'model.h5'))
        
        # Save the tokenizer
        import pickle
        with open(os.path.join(model_path, 'tokenizer.pickle'), 'wb') as handle:
            pickle.dump(self.tokenizer, handle, protocol=pickle.HIGHEST_PROTOCOL)
        
        # Save the label encoder
        with open(os.path.join(model_path, 'label_encoder.pickle'), 'wb') as handle:
            pickle.dump(self.label_encoder, handle, protocol=pickle.HIGHEST_PROTOCOL)
    
    def load_model(self, model_path):
        """Load a trained model"""
        import pickle
        
        # Load the model
        self.model = load_model(os.path.join(model_path, 'model.h5'))
        
        # Load the tokenizer
        with open(os.path.join(model_path, 'tokenizer.pickle'), 'rb') as handle:
            self.tokenizer = pickle.load(handle)
        
        # Load the label encoder
        with open(os.path.join(model_path, 'label_encoder.pickle'), 'rb') as handle:
            self.label_encoder = pickle.load(handle)

if __name__ == "__main__":
    # Example usage
    classifier = CommandClassifier()
    classifier.train("data/commands-classification-cleaned.csv")
    classifier.save_model("trained_command_classifier")
    
    # Test the model with a few examples
    test_commands = [
        "ls -la",
        "cat /etc/passwd",
        "rm -rf --no-preserve-root /"
    ]
    
    for cmd in test_commands:
        result = classifier.predict(cmd)
        print(f"Command: {cmd}")
        print(f"Classification: {result['classification']}")
        print(f"Confidence: {result['confidence']:.4f}")
        print("Probabilities:", result['probabilities'])
        print()
