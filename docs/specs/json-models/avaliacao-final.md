# Avaliação final

Modelo para importar a avaliação final de um curso, com 5 perguntas de múltipla escolha e 4 alternativas cada.

```json
{
  "title": "Avaliação final",
  "description": "Modelo para o quiz final do curso.",
  "passing_score": 70,
  "max_attempts": 3,
  "estimated_minutes": 15,
  "questions": [
    {
      "question_text": "Qual alternativa resume melhor a organização do curso?",
      "question_type": "single_choice",
      "points": 1,
      "is_required": true,
      "options": [
        {
          "option_text": "Módulos, aulas e avaliações trabalham juntos para estruturar o aprendizado.",
          "is_correct": true
        },
        {
          "option_text": "O curso só possui uma lista solta de textos.",
          "is_correct": false
        },
        {
          "option_text": "Os módulos não têm relação com as aulas.",
          "is_correct": false
        },
        {
          "option_text": "A avaliação final substitui todo o conteúdo do curso.",
          "is_correct": false
        }
      ]
    },
    {
      "question_text": "Como o JSON exportado trata as aulas ricas?",
      "question_type": "single_choice",
      "points": 1,
      "is_required": true,
      "options": [
        {
          "option_text": "Ele preserva os blocos estruturados além do texto consolidado.",
          "is_correct": true
        },
        {
          "option_text": "Ele elimina todos os blocos e deixa só o título.",
          "is_correct": false
        },
        {
          "option_text": "Ele converte tudo para imagem.",
          "is_correct": false
        },
        {
          "option_text": "Ele ignora o conteúdo da aula.",
          "is_correct": false
        }
      ]
    },
    {
      "question_text": "Quando usar um módulo avulso?",
      "question_type": "single_choice",
      "points": 1,
      "is_required": true,
      "options": [
        {
          "option_text": "Quando você quer substituir ou anexar um módulo em um curso existente.",
          "is_correct": true
        },
        {
          "option_text": "Somente ao criar um curso do zero.",
          "is_correct": false
        },
        {
          "option_text": "Apenas para avaliações finais.",
          "is_correct": false
        },
        {
          "option_text": "Quando não há aulas dentro dele.",
          "is_correct": false
        }
      ]
    },
    {
      "question_text": "O que deve existir em um curso completo exportado?",
      "question_type": "single_choice",
      "points": 1,
      "is_required": true,
      "options": [
        {
          "option_text": "Metadados do curso e uma lista de módulos.",
          "is_correct": true
        },
        {
          "option_text": "Somente uma avaliação final.",
          "is_correct": false
        },
        {
          "option_text": "Apenas o título do primeiro módulo.",
          "is_correct": false
        },
        {
          "option_text": "Somente o conteúdo do editor visual.",
          "is_correct": false
        }
      ]
    },
    {
      "question_text": "Qual é a função da avaliação final?",
      "question_type": "single_choice",
      "points": 1,
      "is_required": true,
      "options": [
        {
          "option_text": "Validar a assimilação geral do curso.",
          "is_correct": true
        },
        {
          "option_text": "Reescrever todos os módulos automaticamente.",
          "is_correct": false
        },
        {
          "option_text": "Substituir o conteúdo das aulas.",
          "is_correct": false
        },
        {
          "option_text": "Remover a necessidade de perguntas.",
          "is_correct": false
        }
      ]
    }
  ],
  "case_studies": []
}
```
