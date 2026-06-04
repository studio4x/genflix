# Avaliação final

Modelo para importar a avaliação final de um curso.

```json
{
  "title": "Avaliação final",
  "description": "Modelo para o quiz final do curso.",
  "passing_score": 70,
  "max_attempts": 3,
  "estimated_minutes": 15,
  "questions": [
    {
      "question_text": "Qual alternativa resume melhor o conteúdo apresentado?",
      "question_type": "single_choice",
      "points": 1,
      "is_required": true,
      "options": [
        {
          "option_text": "A estrutura do curso organiza o conteúdo em módulos, aulas e avaliações.",
          "is_correct": true
        },
        {
          "option_text": "O JSON só suporta texto simples sem estrutura.",
          "is_correct": false
        }
      ]
    }
  ],
  "case_studies": [
    {
      "title": "Aplicação prática",
      "case_text": "Leia o cenário e responda com base nos conceitos do curso.",
      "questions": [
        {
          "question_text": "Como você aplicaria o conteúdo aprendido nesse cenário?",
          "question_type": "essay_ai",
          "points": 2,
          "is_required": true,
          "essay_expected_answer": "Resposta aberta demonstrando compreensão prática do conteúdo."
        }
      ]
    }
  ]
}
```
