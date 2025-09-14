import json
from datetime import datetime
import time

from openai import OpenAI, NotFoundError

import config
from mongodb import create_thread, get_thread,save_flight_offers
from utils import format_messages, call_amadeus_search, get_amadeus_token

client = OpenAI(
    api_key=config.OPENAI_API_KEY
)



def ask_openai_assistant(query: str, recipient_id: str, messages: list[dict[str, str]]) -> str:
    try:
        # Retrieve or create a thread
        thread_from_db = get_thread(recipient_id=recipient_id)
        thread = None
        if thread_from_db:
            try:
                thread = client.beta.threads.retrieve(
                    thread_id=thread_from_db["thread_id"]
                )
            except NotFoundError as ne:
                print(ne.message)
                thread = client.beta.threads.create(
                    messages=messages
                )
        else:
            thread = client.beta.threads.create(
                messages=messages
            )
            thread_for_db = {
                'created_at': datetime.now().isoformat(),
                "thread_id": thread.id,
                "recipient_id": recipient_id
            }
            create_thread(thread=thread_for_db)

        # Check for active runs
        active_run = None
        try:
            active_run = client.beta.threads.runs.list(thread_id=thread.id).data[0]
            if active_run.status not in ['completed', 'failed']:
                print(f"Active run found: {active_run.id}, waiting for completion.")
                while active_run.status not in ['completed', 'failed']:
                    time.sleep(1)
                    active_run = client.beta.threads.runs.retrieve(
                        thread_id=thread.id,
                        run_id=active_run.id
                    )
        except IndexError:
            # No active runs, safe to proceed
            pass

        # Add user message to the thread
        _ = client.beta.threads.messages.create(
            thread_id=thread.id,
            content=query,
            role='user'
        )

        # Start a new assistant run
        run = client.beta.threads.runs.create(
            thread_id=thread.id,
            assistant_id=config.ASSISTANT_ID
        )
        print(f"Run ID: {run.id}")

        # Poll the run until completion
        flag = True
        while flag:
            retrieved_run = client.beta.threads.runs.retrieve(
                thread_id=thread.id,
                run_id=run.id
            )

            # ---------------------- Handle Function Calling ----------------------
            if retrieved_run.required_action and retrieved_run.required_action.submit_tool_outputs:
                print("Function calls detected:")
                tool_outputs = []

                for tool_call in retrieved_run.required_action.submit_tool_outputs.tool_calls:
                    print(f"\nProcessing tool call:")
                    print(f"Function: {tool_call.function.name}")
                    print(f"Arguments: {tool_call.function.arguments}")

                    function_name = tool_call.function.name
                    params = json.loads(tool_call.function.arguments)

                    result = {}
                    try:
                        if function_name == "search_flight_offers":
                            result = call_amadeus_search(params)

                            try:
                                save_flight_offers(recipient_id, params)
                                print("✅ Flight offers saved to DB.")
                            except Exception as db_err:
                                print("⚠️ Could not save flight offers:", db_err)

                        else:
                            print(f"Unknown function: {function_name}")
                            result = {"error": f"Unknown function: {function_name}"}
                    except Exception as e:
                        print(f"Error in {function_name}: {str(e)}")
                        result = {"error": str(e)}

                    # Add the result to tool outputs
                    tool_outputs.append({
                        "tool_call_id": tool_call.id,
                        "output": json.dumps(result)
                    })

                # Submit all tool outputs
                if tool_outputs:
                    try:
                        run = client.beta.threads.runs.submit_tool_outputs_and_poll(
                            thread_id=thread.id,
                            run_id=run.id,
                            tool_outputs=tool_outputs
                        )
                        print("Tool outputs submitted successfully")
                    except Exception as e:
                        print(f"Failed to submit tool outputs: {e}")

            # ---------------------- End Function Calling ----------------------

            if retrieved_run.status == 'completed':
                flag = False
            elif retrieved_run.status == 'failed':
                return config.ERROR_MESSAGE

            time.sleep(1)

        # Retrieve and return the first message content
        retrieved_messages = client.beta.threads.messages.list(
            thread_id=thread.id
        )
        print(f"First Message: {retrieved_messages.data[0]}")
        message_text = retrieved_messages.data[0].content[0].text.value
        return message_text

    except Exception as e:
        print(f"An error occurred: {e}")
        return config.ERROR_MESSAGE
