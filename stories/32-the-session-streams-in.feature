Feature: The session streams in

  "with not just ROOT shake, but any instance where i interact with an Agent on QNTX, it doesnt stream in, only the [tool] and [mcp] pieces fly in."
  "i still want the transcript reader"
  "and i want something else to do the live session"
  "I want to see the most honest and least data-lossy representation of what there is to show."

  Scenario: ROOT says something to the Node Agent and watches it answer
    Given I am ROOT with the Claude element open
    When I say "What would you tell people at a claude code community meetup?" to it
    Then its words arrive while it answers
    And once it has answered, the transcript holds them and the live view is gone
