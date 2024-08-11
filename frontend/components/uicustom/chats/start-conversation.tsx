'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Spinner from '../spinner';


// Define a Participant type
interface Participant {
  input: string;
  name: string;
  email: string;
}

function StartConversationForm() {
  const [title, setTitle] = useState('');
  const [input, setInput] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]); // Use the Participant type
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(''); // State for error messages
  const router = useRouter();

  const handleAddParticipant = async () => {
    if (!input || participants.some(p => p.input === input)) return;

    setLoading(true);
    setError(''); // Clear any previous errors

    try {
      const response = await fetch('/api/validate-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      });

      const result = await response.json();

      if (response.ok && result.isValid) {
        setParticipants([...participants, { input, name: result.user.name, email: result.user.email }]);
        setInput(''); // Clear the input field after adding
      } else {
        setError(result.message || 'Invalid participant');
      }
    } catch (error) {
      console.error('Failed to validate participant:', error);
      setError('Failed to validate participant');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = (removedInput: string) => {
    setParticipants(participants.filter(e => e.input !== removedInput));
  };

  const handleStartConversation = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          participants: participants.map(p => p.email), // Pass emails to backend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }

      const data = await response.json();
      console.log('Conversation started:', data);
      
      // Navigate to the conversation page after successful creation
      router.push(`/conversations/${data.id}`);
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };
  
  const style = {
    baseRoot: 'flex flex-col justify-center items-start w-full px-4 py-2',
    baseItem: 'flex flex-col md:flex-row justify-between items-center w-full px-4 py-4 hover:bg-white/30 dark:hover:bg-black/30 transition-colors duration-300 rounded',
    txtArea: 'p-2 w-full border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    input: 'p-2 w-full border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    inputCheckbox: 'border bg-slate-50 hover:bg-slate-200 dark:bg-black/70 dark:hover:bg-black/60 border-gray-200 dark:border-gray-600 text-black dark:text-white rounded focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition transform duration-300 ease-in-out',
    dropzone: 'border border-dashed border-gray-400 dark:border-gray-400 rounded-md p-2 text-center',
  };

  return (
    <div className={`${style.baseRoot} hover:bg-white/20 dark:hover:bg-black/20 transition-colors duration-300 rounded`}>
      <h1 className='font-bold text-lg'>Create a new Conversation</h1>
      <div className={`flex flex-col justify-between items-center w-full p-4 gap-2`}>
        <input
          className={`${style.input} `}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Conversation Title"
        />
        {title.length > 0 && <div className='w-full flex gap-2'>
          <input
            className={`${style.input} `}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add Participant by Name, Email or User ID"
          />
          <Button
            variant='vegaNormalBtn'
            onClick={handleAddParticipant}
            disabled={loading}
          >
            {loading ? <Spinner /> : 'Add Participant'}
          </Button>
        </div>}
        {error && (
          <p className="text-red-500 mt-2">{error}</p> // Display error message
        )}
      </div>
      {title.length > 0 && participants.length > 0 && participants.length < 2 &&(
        <div className={`flex flex-col justify-center items-center w-full p-4 gap-2`}>
          <div className='text-center md:w-[540px] hover:bg-white/30 dark:hover:bg-black/30 transition-colors duration-300 rounded p-4'>
            <h1 className='font-bold text-lg capitalize'>{title}</h1>
            <div className='p-2'>
              <ul className={`${style.baseRoot} gap-2`}>
                <h1 className='font-bold text-lg text-center w-full'>1/2 Participants Required</h1>
                {participants.map((participant, index) => (
                  <li key={index} className={`${style.input} flex justify-between items-center px-4`}>
                  <h2 className='font-lg font-semibold'>{participant.name} ({participant.email})</h2>
                  <Button variant='vegaNormalBtnRed' onClick={() => handleRemoveParticipant(participant.input)}>Remove</Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      {title.length > 0 && participants.length > 1 && (
        <div className={`flex flex-col justify-center items-center w-full p-4 gap-2`}>
          <div className='text-center md:w-[540px] hover:bg-white/30 dark:hover:bg-black/30 transition-colors duration-300 rounded p-4'>
            <h1 className='font-bold text-lg capitalize'>{title}</h1>
            <div className='p-2'>
              <ul className={`${style.baseRoot} gap-2`}>
                {participants.map((participant, index) => (
                  <li key={index} className={`${style.input} flex justify-between items-center px-4`}>
                  <h2 className='font-lg font-semibold'>{participant.name} ({participant.email})</h2>
                  <Button variant='vegaNormalBtnRed' onClick={() => handleRemoveParticipant(participant.input)}>Remove</Button>
                  </li>
                ))}
              </ul>
            </div>
            <Button variant='vegaEmeraldBtn' onClick={handleStartConversation}>Start Conversation</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StartConversationForm;