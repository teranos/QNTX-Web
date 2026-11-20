Feature: ROOT authors what agents say to an agent

  "Agents cant wake Agents willy nilly"
  "i dont want a separate screen, a separate ui to have to go to"
  "I OPEN THE APP ON MY PHONE"
  "I OPEN THE NODE AGENT"
  "IF THERE ARE MESSAGES PENDING TO BE SENT, AS A COLLECTED BATCH, I SEE IT BOTTOM LEFTSIDE. SLIGHTLY TRANSPARENT. AND I CAN MOVE IT UP IF IT WANT TO."
  "IF I PRESS ON IT, IT OPENS UP FULLSCREEN."
  "I CAN SEE WHO SAID WHAT,"
  "EDIT THE TEXT,"
  "SEND IT NOW,"
  "DELAY QUICKLY (GET'S COLLECTED WITH THE NEXT BATCH), DELAY LONGER BY KEEPING IT PRESSED AND DRAGGING HOW MUCH(UP/DOWN)RELEASE-CONFIRM."
  "OR CANCEL."
  "THE UI CONTROLS ARE DISPLAYED IN THE HEADER AREA."
  "THE THING IS AN ELEMENT"
  "CANCELS THE MESSAGE"
  "I AUTHOR, I CHANGE WHATEVER I WANT ABOUT WHAT AN AGENT RECEIVES"
  "WHEN I DELAY, I MEANS, THE MESSAGE WILL COLLECT EVERYTHING THAT COMES IN IN THE MEANTIME AS WELL"
  "About it taking over everything for no good reason?"
  "THE OLD PATTERN IS BAD"
  "I want you to use the pills for it instead"
  "The pills should be above, and outside of inputfield area"
  "I want inputfield to still be there"
  "QNTX-Web: adopting the exemplar there."

  Background:
    Given I am ROOT on my phone, and agents said three things to the Node Agent that wait
    And I open the Node Agent

  Scenario: ROOT sees what waits, where they already are
    Then I see the batch that waits as a pill above where I type
    And it says how many wait and when they are sent

  Scenario: ROOT talks to the Node Agent in another harness
    When I press the codex tab of the chat
    Then I see the batch that waits as a pill above where I type

  Scenario: ROOT sees who said what
    When I press the batch
    Then it is across its row, and where I type is still there
    And I see who said what
    And send now, later, hold and cancel are on one line above it

  Scenario: ROOT edits the text
    Given I pressed the batch
    When I change what Alder said first
    Then the node holds what I wrote, and marks it changed by a person

  Scenario: ROOT sends it now
    Given I pressed the batch
    When I press send now, twice
    Then the Node Agent receives all of it as one thing said
    And nothing waits in the chat

  Scenario: ROOT delays quickly
    Given I pressed the batch
    When I press later
    Then it is sent one wait later than it was
    And what an agent says in the meantime is in the same batch

  Scenario: ROOT delays longer
    Given I pressed the batch
    When I keep hold pressed and drag up
    Then it says how much longer as I drag
    When I let go, and confirm
    Then it is sent that much later than it was

  Scenario: ROOT cancels the message
    Given I pressed the batch
    When I press cancel, twice
    Then the Node Agent never receives it
    And nothing waits in the chat

  Scenario: ROOT cancels one thing said
    Given I pressed the batch
    When I press what Hazel said, and cancel, twice
    Then the Node Agent never receives what Hazel said
    And what Alder said still waits
